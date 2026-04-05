/**
 * openclaw.ts — OpenClaw Gateway WebSocket 客户端
 *
 * OpenClaw 私有协议（非 JSON-RPC 2.0）：
 * - 请求帧：{ type: "req", id, method, params }
 * - 响应帧：{ type: "res", id, ok, payload?, error? }
 * - 事件帧：{ type: "event", event: "agent"|"chat"|"connect.challenge", payload }
 *
 * 握手流程：
 * 1. WS open → 等 connect.challenge 事件
 * 2. 收到 challenge → 发 connect 请求（带 client info + auth token）
 * 3. 收到 hello-ok 响应 → 握手完成，可发业务 RPC
 *
 * 不依赖任何第三方库，仅使用原生 WebSocket + crypto.randomUUID()。
 */

import { buildSessionKey, getOrCreateVisitorId } from "./visitor";

// ===========================================================================
// Types
// ===========================================================================

/** 连接状态 */
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

/** 聊天消息（chat.history 返回 + UI 渲染用） */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

/** agent 事件 payload（token 级粒度流式推送） */
export interface AgentStreamEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  stream: string; // "assistant" | "lifecycle" | ...
  data: {
    text?: string;   // 累积全文
    delta?: string;  // 本次增量
    phase?: string;  // lifecycle: "start" | "end"
  };
  ts: number;
}

/** chat 聚合事件 payload（每 ~10 token 一次） */
export interface ChatAggEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: {
    role: string;
    content: Array<{ type: string; text: string }>;
    timestamp?: number;
  };
  errorMessage?: string;
  stopReason?: string;
}

/** chat.send 的 ack 响应 */
export interface SendAck {
  runId: string;
  status: string;
}

/** chat.history 的响应结构 */
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
// 事件回调类型（暴露给 useChat hook）
// ===========================================================================

/** hook 统一消费的流式事件 */
export interface StreamEvent {
  runId: string;
  sessionKey: string;
  kind: "delta" | "final" | "aborted" | "error" | "lifecycle";
  /** delta/final 时的文本 */
  text: string;
  /** delta 时的增量文本 */
  delta: string;
  /** lifecycle 的阶段 */
  phase?: string;
  /** error 时的错误消息 */
  errorMessage?: string;
}

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

/** 固定的 client instanceId，整个页面生命周期不变 */
const INSTANCE_ID = crypto.randomUUID();

// ===========================================================================
// OpenClawClient
// ===========================================================================

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";

  // 重连
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  // RPC pending Promise，按 id 索引
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();

  // 握手完成前的请求排队
  private handshakeComplete = false;
  private pendingQueue: Array<() => void> = [];

  // 事件订阅
  private messageHandler: MessageHandler | null = null;
  private errorHandler: ErrorHandler | null = null;
  private stateHandler: StateHandler | null = null;

  // connect() 的外部 Promise（跨 WS open → handshake complete）
  private connectResolve: (() => void) | null = null;
  private connectReject: ((err: Error) => void) | null = null;

  // =========================================================================
  // 公共 API
  // =========================================================================

  /**
   * 打开 WebSocket 连接并完成 connect.challenge 握手。
   * Promise 在 hello-ok 收到后才 resolve。
   */
  connect(): Promise<void> {
    if (MOCK_MODE) {
      console.log("[mock] connect — 模拟已连接");
      this.setState("connected");
      this.handshakeComplete = true;
      return Promise.resolve();
    }
    if (this.handshakeComplete && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.ws && this.ws.readyState <= WebSocket.OPEN && this.connectResolve) {
      // 已经在连接/握手中，返回一个新 Promise 等握手完成
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

  /** 主动断开连接，停止自动重连。 */
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

  /**
   * 发送聊天消息。
   * 返回 runId（从 ack 的 payload 中取）。
   */
  async sendChat(text: string): Promise<string> {
    if (MOCK_MODE) return this.mockSendChat(text);
    const idempotencyKey = crypto.randomUUID();
    const payload = (await this.rpc("chat.send", {
      sessionKey: buildSessionKey(),
      message: text,
      idempotencyKey,
    })) as SendAck;
    return payload.runId;
  }

  /** 拉取聊天历史。 */
  async getHistory(limit = 50): Promise<ChatMessage[]> {
    if (MOCK_MODE) return [];
    const result = (await this.rpc("chat.history", {
      sessionKey: buildSessionKey(),
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

  /** 注入访客上下文（chat.inject，一次会话只注入一次）。 */
  async injectVisitorContext(): Promise<void> {
    if (MOCK_MODE) return;
    const sessionKey = buildSessionKey();
    const storageFlag = `lingmin_ctx_injected:${sessionKey}`;
    if (sessionStorage.getItem(storageFlag)) return;

    const visitorId = getOrCreateVisitorId();
    const contextText = [
      "访客上下文:",
      `visitor_id: ${visitorId}`,
      "source: official_website",
      "entry_agent: lingmin",
    ].join("\n");

    await this.rpc("chat.inject", {
      sessionKey,
      message: contextText,
      label: "visitor_context",
    });

    sessionStorage.setItem(storageFlag, "1");
  }

  /** 中断当前 AI 生成。 */
  async abort(): Promise<void> {
    await this.rpc("chat.abort", {
      sessionKey: buildSessionKey(),
    });
  }

  onMessage(handler: MessageHandler): void { this.messageHandler = handler; }
  onError(handler: ErrorHandler): void { this.errorHandler = handler; }
  onStateChange(handler: StateHandler): void { this.stateHandler = handler; }
  getState(): ConnectionState { return this.state; }

  // =========================================================================
  // Mock 模式
  // =========================================================================

  private mockSendChat(text: string): Promise<string> {
    const runId = crypto.randomUUID();
    const sessionKey = buildSessionKey();
    const chunks = ["你好", "！我是", "灵敏", "AI，", "文案创作", "助手。", "有什么", "可以帮你的？"];
    let accumulated = "";
    setTimeout(() => {
      let seq = 0;
      const interval = setInterval(() => {
        if (seq < chunks.length) {
          accumulated += chunks[seq];
          this.messageHandler?.({ runId, sessionKey, kind: "delta", text: accumulated, delta: chunks[seq] });
          seq++;
        } else {
          clearInterval(interval);
          this.messageHandler?.({ runId, sessionKey, kind: "final", text: accumulated, delta: "" });
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

  /**
   * 创建 WebSocket，等待 open → challenge → connect → hello-ok。
   * connect() 的 Promise 在 hello-ok 时 resolve。
   */
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
        // 不在这里 resolve — 等 hello-ok 才算连接完成
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
      default:
        // 忽略未知帧类型
        break;
    }
  }

  /** 处理事件帧 */
  private handleEvent(frame: OcEvent): void {
    switch (frame.event) {
      case "connect.challenge":
        // 收到 challenge → 立刻发 connect 请求
        this.sendConnectRequest();
        break;

      case "agent":
        this.handleAgentEvent(frame.payload);
        break;

      case "chat":
        this.handleChatEvent(frame.payload);
        break;

      default:
        // connect.ready、ping 等忽略
        break;
    }
  }

  /** 处理响应帧 */
  private handleResponse(frame: OcResponse): void {
    // hello-ok 响应（connect 请求的回复）
    if (frame.ok && frame.payload && typeof frame.payload === "object") {
      const p = frame.payload as Record<string, unknown>;
      if (p.type === "hello-ok") {
        this.handshakeComplete = true;
        this.setState("connected");
        this.connectResolve?.();
        this.connectResolve = null;
        this.connectReject = null;
        // 释放排队的业务请求
        this.flushQueue();
        // 不 return — 也要 resolve pending 里的 connect RPC promise
      }
    }

    // 匹配 pending RPC
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

    // 把 connect 请求也注册到 pending，但 hello-ok 在 handleResponse 中特殊处理
    this.pending.set(connectFrame.id, {
      resolve: () => {},
      reject: (e) => { this.connectReject?.(e); },
    });

    this.ws.send(JSON.stringify(connectFrame));
  }

  // =========================================================================
  // 流式事件处理
  // =========================================================================

  /**
   * 处理 event:"agent" — token 级粒度。
   * stream="assistant" → delta 文本
   * stream="lifecycle" → run 开始/结束
   */
  private handleAgentEvent(payload: unknown): void {
    if (!this.messageHandler || !payload) return;
    const p = payload as Record<string, unknown>;
    const mySessionKey = buildSessionKey();
    if (p.sessionKey && p.sessionKey !== mySessionKey) return;

    const stream = p.stream as string;
    const data = (p.data ?? {}) as Record<string, unknown>;
    const runId = (p.runId as string) ?? "";

    if (stream === "assistant") {
      this.messageHandler({
        runId,
        sessionKey: mySessionKey,
        kind: "delta",
        text: (data.text as string) ?? "",
        delta: (data.delta as string) ?? "",
      });
    } else if (stream === "lifecycle") {
      this.messageHandler({
        runId,
        sessionKey: mySessionKey,
        kind: "lifecycle",
        text: "",
        delta: "",
        phase: (data.phase as string) ?? "",
      });
    }
  }

  /**
   * 处理 event:"chat" — 聚合事件。
   * 用于 state="final"/"aborted"/"error" 的收尾。
   */
  private handleChatEvent(payload: unknown): void {
    if (!this.messageHandler || !payload) return;
    const p = payload as Record<string, unknown>;
    const mySessionKey = buildSessionKey();
    if (p.sessionKey && p.sessionKey !== mySessionKey) return;

    const state = p.state as string;
    const runId = (p.runId as string) ?? "";

    if (state === "final") {
      // 从 message.content[0].text 取完整文本
      let text = "";
      const msg = p.message as Record<string, unknown> | undefined;
      if (msg && Array.isArray(msg.content)) {
        text = (msg.content as Array<{ type: string; text: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("");
      }
      this.messageHandler({ runId, sessionKey: mySessionKey, kind: "final", text, delta: "" });
    } else if (state === "aborted") {
      this.messageHandler({ runId, sessionKey: mySessionKey, kind: "aborted", text: "", delta: "" });
    } else if (state === "error") {
      this.messageHandler({
        runId,
        sessionKey: mySessionKey,
        kind: "error",
        text: "",
        delta: "",
        errorMessage: (p.errorMessage as string) ?? "生成出错",
      });
    }
    // state="delta" 的 chat 事件忽略，优先用 agent 事件
  }

  // =========================================================================
  // RPC 发送（带握手排队）
  // =========================================================================

  /**
   * 发送业务 RPC 请求。
   * 如果握手未完成，请求会排队等 hello-ok 后自动发出。
   */
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
        // 排队等握手完成
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
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.openSocket().catch(() => {});
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
