/**
 * openclaw.ts — OpenClaw Gateway WebSocket 客户端（多智能体版）
 *
 * OpenClaw 私有协议（非 JSON-RPC 2.0）：
 * - 请求帧：{ type: "req", id, method, params }
 * - 响应帧：{ type: "res", id, ok, payload?, error? }
 * - 事件帧：{ type: "event", event: "agent"|"chat"|"connect.challenge", payload }
 *
 * 单一 WebSocket 连接服务多个 agent，通过 sessionKey 路由事件到对应的订阅者。
 */

import { buildSessionKey, getOrCreateVisitorId } from "./visitor";

// ===========================================================================
// Types
// ===========================================================================

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

/** hook 统一消费的流式事件 */
export interface StreamEvent {
  runId: string;
  sessionKey: string;
  kind: "delta" | "final" | "aborted" | "error" | "lifecycle";
  text: string;
  delta: string;
  phase?: string;
  errorMessage?: string;
}

export interface SendAck {
  runId: string;
  status: string;
}

export interface HistoryResult {
  sessionKey: string;
  messages: ChatMessage[];
  thinkingLevel?: unknown;
}

// ===========================================================================
// OpenClaw 私有协议帧类型
// ===========================================================================

interface OcRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface OcResponse {
  type: "res";
  id: string;
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
// 回调类型
// ===========================================================================

type MessageHandler = (event: StreamEvent) => void;
type ErrorHandler = (error: string) => void;
type StateHandler = (state: ConnectionState) => void;

// ===========================================================================
// 常量
// ===========================================================================

const WS_BASE_URL: string =
  import.meta.env.VITE_OPENCLAW_WS_URL ?? "ws://127.0.0.1:18889";

const WS_TOKEN: string = import.meta.env.VITE_OPENCLAW_TOKEN ?? "";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

const OMITTED_PLACEHOLDER = "[chat.history omitted: message too large]";

const MOCK_MODE = import.meta.env.VITE_OPENCLAW_MOCK === "true";

const INSTANCE_ID = crypto.randomUUID();

// ===========================================================================
// OpenClawClient — 多智能体单连接
// ===========================================================================

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";

  // 重连
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  // RPC pending
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  // 握手
  private handshakeComplete = false;
  private pendingQueue: Array<() => void> = [];
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  // 多订阅者：sessionKey → handler[]
  private subscribers = new Map<string, Set<MessageHandler>>();

  // 全局事件（不分 sessionKey）
  private errorHandler: ErrorHandler | null = null;
  private stateHandler: StateHandler | null = null;

  // =========================================================================
  // 公共 API
  // =========================================================================

  connect(): Promise<void> {
    if (MOCK_MODE) {
      this.setState("connected");
      this.handshakeComplete = true;
      return Promise.resolve();
    }
    if (this.handshakeComplete && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.ws && this.ws.readyState <= WebSocket.OPEN && this.connectResolve) {
      return new Promise((resolve, reject) => {
        const orig = this.connectResolve;
        const origRej = this.connectReject;
        this.connectResolve = () => { orig?.(); resolve(); };
        this.connectReject = (e) => { origRej?.(e); reject(e); };
      });
    }
    this.intentionallyClosed = false;
    return this.openSocket();
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.clearReconnect();
    this.handshakeComplete = false;
    this.pendingQueue = [];
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.rejectAllPending("连接已断开");
    this.setState("disconnected");
  }

  /** 发送聊天消息（指定 agentId）。返回 runId。 */
  async sendChat(agentId: string, text: string): Promise<string> {
    if (MOCK_MODE) return this.mockSendChat(agentId, text);
    const idempotencyKey = crypto.randomUUID();
    const payload = (await this.rpc("chat.send", {
      sessionKey: buildSessionKey(agentId),
      message: text,
      idempotencyKey,
    })) as SendAck;
    return payload.runId;
  }

  /** 拉取聊天历史（指定 agentId）。 */
  async getHistory(agentId: string, limit = 50): Promise<ChatMessage[]> {
    if (MOCK_MODE) return [];
    const result = (await this.rpc("chat.history", {
      sessionKey: buildSessionKey(agentId),
      limit,
    })) as HistoryResult;

    return (result.messages ?? []).map((msg) => ({
      ...msg,
      content:
        msg.content === OMITTED_PLACEHOLDER
          ? "（此消息因过长已省略）"
          : msg.content,
    }));
  }

  /** 注入访客上下文（指定 agentId，每个 agent 一次会话只注入一次）。 */
  async injectVisitorContext(agentId: string): Promise<void> {
    if (MOCK_MODE) return;
    const sessionKey = buildSessionKey(agentId);
    const storageFlag = `lingmin_ctx_injected:${sessionKey}`;
    if (sessionStorage.getItem(storageFlag)) return;

    const visitorId = getOrCreateVisitorId();
    const contextText = [
      "访客上下文:",
      `visitor_id: ${visitorId}`,
      "source: official_website",
      `entry_agent: ${agentId}`,
    ].join("\n");

    await this.rpc("chat.inject", {
      sessionKey,
      message: contextText,
      label: "visitor_context",
    });

    sessionStorage.setItem(storageFlag, "1");
  }

  /** 中断当前 AI 生成（指定 agentId）。 */
  async abort(agentId: string): Promise<void> {
    await this.rpc("chat.abort", {
      sessionKey: buildSessionKey(agentId),
    });
  }

  // =========================================================================
  // 多订阅者管理：按 sessionKey 路由
  // =========================================================================

  /** 订阅指定 sessionKey 的流式事件。返回取消订阅函数。 */
  subscribe(sessionKey: string, handler: MessageHandler): () => void {
    if (!this.subscribers.has(sessionKey)) {
      this.subscribers.set(sessionKey, new Set());
    }
    this.subscribers.get(sessionKey)!.add(handler);
    return () => {
      const set = this.subscribers.get(sessionKey);
      if (set) {
        set.delete(handler);
        if (set.size === 0) this.subscribers.delete(sessionKey);
      }
    };
  }

  onError(handler: ErrorHandler): void { this.errorHandler = handler; }
  onStateChange(handler: StateHandler): void { this.stateHandler = handler; }
  getState(): ConnectionState { return this.state; }

  // =========================================================================
  // Mock 模式
  // =========================================================================

  private mockSendChat(agentId: string, text: string): Promise<string> {
    const runId = crypto.randomUUID();
    const sessionKey = buildSessionKey(agentId);
    const chunks = ["你好", "！我是", agentId, "，", "有什么", "可以帮你的？"];
    let accumulated = "";
    setTimeout(() => {
      let seq = 0;
      const interval = setInterval(() => {
        if (seq < chunks.length) {
          accumulated += chunks[seq];
          this.dispatchToSubscribers(sessionKey, { runId, sessionKey, kind: "delta", text: accumulated, delta: chunks[seq] });
          seq++;
        } else {
          clearInterval(interval);
          this.dispatchToSubscribers(sessionKey, { runId, sessionKey, kind: "final", text: accumulated, delta: "" });
        }
      }, 80);
    }, 500);
    return Promise.resolve(runId);
  }

  // =========================================================================
  // 内部实现
  // =========================================================================

  private setState(s: ConnectionState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateHandler?.(s);
  }

  /** 向指定 sessionKey 的所有订阅者分发事件 */
  private dispatchToSubscribers(sessionKey: string, event: StreamEvent): void {
    const handlers = this.subscribers.get(sessionKey);
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState("connecting");
      this.handshakeComplete = false;
      this.connectResolve = resolve;
      this.connectReject = reject;

      const url = WS_TOKEN
        ? `${WS_BASE_URL}?token=${encodeURIComponent(WS_TOKEN)}`
        : WS_BASE_URL;

      const ws = new WebSocket(url);

      ws.onopen = () => {
        this.reconnectAttempt = 0;
      };

      ws.onclose = () => {
        this.handshakeComplete = false;
        this.setState("disconnected");
        this.rejectAllPending("连接已断开");
        this.connectReject?.(new Error("连接已断开"));
        this.connectResolve = null;
        this.connectReject = null;
        if (!this.intentionallyClosed) this.scheduleReconnect();
      };

      ws.onerror = () => {
        this.setState("error");
        this.errorHandler?.("接待暂时不在线，请稍后再试");
      };

      ws.onmessage = (evt) => {
        this.handleFrame(evt.data as string);
      };

      this.ws = ws;
    });
  }

  // =========================================================================
  // 帧解析与分发
  // =========================================================================

  private handleFrame(raw: string): void {
    let frame: OcFrame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (import.meta.env.DEV) {
      const preview = raw.length > 500 ? raw.substring(0, 500) + "..." : raw;
      console.log(`[ws frame] type=${frame.type}`, preview);
    }

    switch (frame.type) {
      case "event":
        this.handleEvent(frame as OcEvent);
        break;
      case "res":
        this.handleResponse(frame as OcResponse);
        break;
    }
  }

  private handleEvent(frame: OcEvent): void {
    switch (frame.event) {
      case "connect.challenge":
        this.sendConnectRequest();
        break;
      case "agent":
        this.handleAgentEvent(frame.payload);
        break;
      case "chat":
        this.handleChatEvent(frame.payload);
        break;
    }
  }

  private handleResponse(frame: OcResponse): void {
    if (frame.ok && frame.payload && typeof frame.payload === "object") {
      const p = frame.payload as Record<string, unknown>;
      if (p.type === "hello-ok") {
        this.handshakeComplete = true;
        this.setState("connected");
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
        const errMsg = frame.error?.message ?? "请求失败";
        p.reject(new Error(errMsg));
        this.errorHandler?.(errMsg);
      }
    }
  }

  // =========================================================================
  // connect.challenge 握手
  // =========================================================================

  private sendConnectRequest(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const connectFrame: OcRequest = {
      type: "req",
      id: crypto.randomUUID(),
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          version: "0.1.0",
          platform: "browser",
          mode: "ui",
          instanceId: INSTANCE_ID,
        },
        caps: [],
        role: "operator",
        scopes: ["operator.admin", "operator.read", "operator.write", "operator.approvals"],
        auth: { token: WS_TOKEN },
      },
    };

    this.pending.set(connectFrame.id, {
      resolve: () => {},
      reject: (e) => { this.connectReject?.(e); },
    });

    this.ws.send(JSON.stringify(connectFrame));
  }

  // =========================================================================
  // 流式事件 → 按 sessionKey 路由到订阅者
  // =========================================================================

  private handleAgentEvent(payload: unknown): void {
    if (!payload) return;
    const p = payload as Record<string, unknown>;
    const sessionKey = p.sessionKey as string | undefined;
    if (!sessionKey) return;

    const stream = p.stream as string;
    const data = (p.data ?? {}) as Record<string, unknown>;
    const runId = (p.runId as string) ?? "";

    if (stream === "assistant") {
      this.dispatchToSubscribers(sessionKey, {
        runId,
        sessionKey,
        kind: "delta",
        text: (data.text as string) ?? "",
        delta: (data.delta as string) ?? "",
      });
    } else if (stream === "lifecycle") {
      this.dispatchToSubscribers(sessionKey, {
        runId,
        sessionKey,
        kind: "lifecycle",
        text: "",
        delta: "",
        phase: (data.phase as string) ?? "",
      });
    }
  }

  private handleChatEvent(payload: unknown): void {
    if (!payload) return;
    const p = payload as Record<string, unknown>;
    const sessionKey = p.sessionKey as string | undefined;
    if (!sessionKey) return;

    const state = p.state as string;
    const runId = (p.runId as string) ?? "";

    if (state === "final") {
      let text = "";
      const msg = p.message as Record<string, unknown> | undefined;
      if (msg && Array.isArray(msg.content)) {
        text = (msg.content as Array<{ type: string; text: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");
      }
      this.dispatchToSubscribers(sessionKey, { runId, sessionKey, kind: "final", text, delta: "" });
    } else if (state === "aborted") {
      this.dispatchToSubscribers(sessionKey, { runId, sessionKey, kind: "aborted", text: "", delta: "" });
    } else if (state === "error") {
      this.dispatchToSubscribers(sessionKey, {
        runId, sessionKey, kind: "error", text: "", delta: "",
        errorMessage: (p.errorMessage as string) ?? "生成出错",
      });
    }
  }

  // =========================================================================
  // RPC（带握手排队）
  // =========================================================================

  private rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const doSend = () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error("接待暂时不在线，请稍后再试"));
          return;
        }
        const id = crypto.randomUUID();
        const request: OcRequest = { type: "req", id, method, params };
        this.pending.set(id, { resolve, reject });
        this.ws.send(JSON.stringify(request));
      };

      if (this.handshakeComplete) {
        doSend();
      } else {
        this.pendingQueue.push(doSend);
      }
    });
  }

  private flushQueue(): void {
    const queue = this.pendingQueue;
    this.pendingQueue = [];
    queue.forEach((fn) => fn());
  }

  private rejectAllPending(reason: string): void {
    this.pending.forEach((p) => p.reject(new Error(reason)));
    this.pending.clear();
  }

  // =========================================================================
  // 重连
  // =========================================================================

  private scheduleReconnect(): void {
    this.clearReconnect();
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => { this.openSocket().catch(() => {}); }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** 模块级单例 — 所有 agent 共用同一条 WebSocket 连接 */
export const openClawClient = new OpenClawClient();
