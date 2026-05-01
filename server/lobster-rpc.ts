/**
 * server/lobster-rpc.ts — 后端 ↔ OpenClaw Gateway WebSocket 桥
 *
 * 职责：
 * - 启动后建立持久 WebSocket 连接到 ws://OPENCLAW_WS_URL?token=...
 * - 完成 connect.challenge 握手（参考 client/src/lib/openclaw.ts）
 * - 暴露 callRpc(method, params) 调用任意网关 RPC
 * - 暴露 sessions.list / sessions.usage 的便捷方法（前端 stats/sessions 用）
 * - 自动重连（指数退避）
 *
 * 注意：这是只读网关 RPC（拉取数据），不参与聊天 chat.send 流。
 */

import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";

// ===========================================================================
// 配置
// ===========================================================================

const WS_URL =
  process.env.OPENCLAW_WS_URL ??
  process.env.VITE_OPENCLAW_WS_URL ??
  "ws://127.0.0.1:18789";

const TOKEN =
  process.env.OPENCLAW_TOKEN ?? process.env.VITE_OPENCLAW_TOKEN ?? "";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RPC_TIMEOUT_MS = 15_000;

// ===========================================================================
// 协议帧类型
// ===========================================================================

interface OcRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface OcResponse {
  type: "res";
  id?: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message: string; details?: unknown };
}

interface OcEvent {
  type: "event";
  event: string;
  payload?: unknown;
}

type OcFrame = OcRequest | OcResponse | OcEvent;

// ===========================================================================
// 客户端
// ===========================================================================

class LobsterClient {
  private ws: WebSocket | null = null;
  private handshakeComplete = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private pendingQueue: Array<() => void> = [];

  private connectResolve: (() => void) | null = null;
  private connectReject: ((e: Error) => void) | null = null;
  private connectPromise: Promise<void> | null = null;

  private readonly instanceId = randomUUID();

  /**
   * 幂等连接。返回 Promise 在 hello-ok 收到后 resolve。
   * 多次调用共享同一个 Promise。
   */
  connect(): Promise<void> {
    if (this.handshakeComplete) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.intentionallyClosed = false;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openSocket();
    }).finally(() => {
      // 握手完成后清掉 promise 引用，下次 connect 直接 resolve
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  /** 主动断开（很少调用，server 进程结束时） */
  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.handshakeComplete = false;
    this.rejectAllPending("disconnected");
  }

  /** 调用任意网关 RPC method */
  callRpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const send = () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error("Lobster gateway not connected"));
          return;
        }
        const id = randomUUID();
        const req: OcRequest = { type: "req", id, method, params };

        const timer = setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error(`RPC ${method} timeout`));
          }
        }, RPC_TIMEOUT_MS);

        this.pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(v as T); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        });
        this.ws.send(JSON.stringify(req));
      };

      if (this.handshakeComplete) {
        send();
      } else {
        this.pendingQueue.push(send);
        // 触发连接（如果还没连）
        this.connect().catch(reject);
      }
    });
  }

  // =========================================================================
  // 内部：socket + handshake
  // =========================================================================

  private openSocket(): void {
    const url = TOKEN ? `${WS_URL}?token=${encodeURIComponent(TOKEN)}` : WS_URL;
    const ws = new WebSocket(url, { headers: { origin: "http://localhost:3000" } });
    this.ws = ws;

    ws.on("open", () => {
      // 等服务端推 connect.challenge 才发 connect 请求
    });

    ws.on("message", (raw) => {
      this.handleFrame(raw.toString());
    });

    ws.on("close", () => {
      this.handshakeComplete = false;
      this.rejectAllPending("disconnected");
      if (this.connectReject) {
        this.connectReject(new Error("Lobster connection closed before hello-ok"));
        this.connectResolve = null;
        this.connectReject = null;
      }
      if (!this.intentionallyClosed) this.scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[lobster-rpc] WebSocket error:", err.message);
    });
  }

  private handleFrame(raw: string): void {
    let frame: OcFrame;
    try { frame = JSON.parse(raw); } catch { return; }

    switch (frame.type) {
      case "event":
        if ((frame as OcEvent).event === "connect.challenge") {
          this.sendConnectRequest();
        }
        break;

      case "res":
        this.handleResponse(frame as OcResponse);
        break;
    }
  }

  private handleResponse(frame: OcResponse): void {
    // hello-ok 触发握手完成
    if (frame.ok && frame.payload && typeof frame.payload === "object") {
      const p = frame.payload as Record<string, unknown>;
      if (p.type === "hello-ok") {
        this.handshakeComplete = true;
        this.reconnectAttempt = 0;
        console.log("[lobster-rpc] handshake OK");
        this.connectResolve?.();
        this.connectResolve = null;
        this.connectReject = null;
        this.flushQueue();
      }
    }

    if (frame.id && this.pending.has(frame.id)) {
      const p = this.pending.get(frame.id)!;
      this.pending.delete(frame.id);
      if (frame.ok) {
        p.resolve(frame.payload);
      } else {
        p.reject(new Error(frame.error?.message ?? "RPC failed"));
      }
    }
  }

  private sendConnectRequest(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const id = randomUUID();
    const frame: OcRequest = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          version: "0.1.0",
          platform: "node",
          mode: "ui",
          instanceId: this.instanceId,
        },
        caps: [],
        role: "operator",
        scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals"],
        auth: { token: TOKEN },
      },
    };

    // connect 请求的 ack 在 handleResponse 里捕获（hello-ok 路径）
    this.pending.set(id, {
      resolve: () => {},
      reject: (e) => this.connectReject?.(e),
    });
    this.ws.send(JSON.stringify(frame));
  }

  private flushQueue(): void {
    const q = this.pendingQueue;
    this.pendingQueue = [];
    q.forEach((fn) => fn());
  }

  private rejectAllPending(reason: string): void {
    this.pending.forEach((p) => p.reject(new Error(reason)));
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    console.log(`[lobster-rpc] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }
}

// ===========================================================================
// 单例 + 高层封装
// ===========================================================================

export const lobsterClient = new LobsterClient();

/** 应用启动时调一次（非阻塞），让连接尽早建好 */
export function bootLobster(): void {
  lobsterClient.connect().catch((e) => {
    console.warn("[lobster-rpc] initial connect failed (will retry):", e.message);
  });
}

/**
 * 拉取某个 peer 的会话列表。
 *
 * TODO: 假设龙虾网关暴露 sessions.list 方法、入参 { peerId }。
 * 如果实际方法名/字段不同，改这里即可，不影响上层 API。
 */
export interface LobsterSession {
  sessionKey: string;
  agentId: string;
  conversationId?: string;
  title?: string;
  lastMessageAt: string;
  messageCount: number;
}

export async function fetchSessionsList(peerId: string): Promise<LobsterSession[]> {
  const result = await lobsterClient.callRpc<{ sessions?: LobsterSession[] } | LobsterSession[]>(
    "sessions.list",
    { peerId },
  );
  // 兼容两种返回形式
  if (Array.isArray(result)) return result;
  return result?.sessions ?? [];
}

/**
 * 拉取某个 peer 的累计 token / 对话用量。
 *
 * TODO: 假设 sessions.usage 返回总量 + 按 agent 分布。
 */
export interface LobsterUsage {
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
  byAgent?: Record<string, { conversationsTotal: number; tokensIn: number; tokensOut: number }>;
}

export async function fetchSessionsUsage(peerId: string): Promise<LobsterUsage> {
  const result = await lobsterClient.callRpc<LobsterUsage>("sessions.usage", { peerId });
  return result ?? { conversationsTotal: 0, tokensIn: 0, tokensOut: 0 };
}

/**
 * 拉取某个 sessionKey 的完整消息历史。
 * 用于 Profile 页"对话历史"Tab 展开行。
 */
export interface LobsterMessage {
  role: string;
  content: string;
  timestamp?: number;
}

export async function fetchSessionHistory(
  sessionKey: string,
  limit = 200,
): Promise<LobsterMessage[]> {
  const result = await lobsterClient.callRpc<{ messages?: LobsterMessage[] }>(
    "chat.history",
    { sessionKey, limit },
  );
  return result?.messages ?? [];
}

/** 拉取所有用户的聚合用量（管理员仪表盘用） */
export async function fetchGlobalUsageToday(): Promise<{
  conversationsToday: number;
  tokensInToday: number;
  tokensOutToday: number;
  byAgent: Array<{ agentId: string; tokensIn: number; tokensOut: number; conversations: number }>;
}> {
  // TODO: 龙虾网关如有 admin.usage.today 之类方法走这里；当前先尝试 sessions.usage 不带 peerId
  try {
    const result = await lobsterClient.callRpc<{
      conversationsToday?: number;
      tokensInToday?: number;
      tokensOutToday?: number;
      byAgent?: Array<{ agentId: string; tokensIn: number; tokensOut: number; conversations: number }>;
    }>("admin.usage.today", {});
    return {
      conversationsToday: result.conversationsToday ?? 0,
      tokensInToday: result.tokensInToday ?? 0,
      tokensOutToday: result.tokensOutToday ?? 0,
      byAgent: result.byAgent ?? [],
    };
  } catch {
    // 方法不存在或失败 — 返回空统计，不阻塞 dashboard
    return { conversationsToday: 0, tokensInToday: 0, tokensOutToday: 0, byAgent: [] };
  }
}
