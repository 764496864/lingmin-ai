/**
 * useChat — 参数化聊天状态管理 hook（多智能体 + 多对话 + 用户上下文注入）
 *
 * 用法：const { messages, sendMessage, ... } = useChat({ agentId, conversationId? });
 *
 * 行为：
 * - 按 sessionKey 订阅事件流，每个 (agentId × conversationId × peerId) 独立
 * - 登录状态变化自动重算 sessionKey（peerId 切换 visitorId ↔ userId）
 * - 切换 sessionKey 时清空消息并重新初始化
 * - 已登录时 sendMessage 在文本前注入 [user_context] 块（不影响 UI 显示原文）
 * - 历史消息显示时自动剥离 [user_context] 块
 */

import {
  type ChatMessage,
  type ConnectionState,
  type StreamEvent,
  openClawClient,
} from "@/lib/openclaw";
import { buildSessionKey } from "@/lib/visitor";
import { useAuth } from "@/contexts/AuthContext";
import type { AuthUser } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 前端展示用的消息结构 */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  omitted?: boolean;
}

/** 把任意类型的 content 安全转成字符串（防御 lobster 偶尔返回 object/array） */
function toContentString(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  // 数组（content blocks 格式）：拼起 .text 字段
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string") {
          return (c as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  // 对象兜底：{ text: "..." }
  if (typeof content === "object" && typeof (content as { text?: unknown }).text === "string") {
    return (content as { text: string }).text;
  }
  return String(content);
}

/** 判断一条 assistant 消息是否为隐藏的访客/用户上下文注入（整条消息都是上下文 → 不显示） */
function isVisitorContextMessage(msg: ChatMessage): boolean {
  if (msg.role !== "assistant") return false;
  const c = toContentString(msg.content);
  return (
    c.startsWith("访客上下文:") ||
    c.startsWith("[visitor_context]") ||
    c.startsWith("[user_context]") ||
    /^[\s\n]*\[(visitor|user)_context\]/.test(c)
  );
}

/**
 * 剥离消息中的 [user_context] / [visitor_context] 块，避免暴露给用户。
 * 闭合标签缺失时也兜底裁掉残块。
 */
function stripUserContext(content: unknown): string {
  const s = toContentString(content);
  return s
    .replace(/\[user_context\][\s\S]*?\[\/user_context\]\s*/g, "")
    .replace(/\[visitor_context\][\s\S]*?\[\/visitor_context\]\s*/g, "")
    // 没有闭合标签的残块兜底
    .replace(/\[user_context\][\s\S]*$/g, "")
    .replace(/\[visitor_context\][\s\S]*$/g, "")
    // 残余 "访客上下文:" 行也清掉
    .replace(/^访客上下文:[\s\S]*?(?:\n\n|$)/m, "")
    .trimStart();
}

/**
 * 判断错误是否是"会话尚不存在"——这种错误对新用户/新 sessionKey 是正常的，
 * 不应该弹 toast 吓到用户。
 */
function isSessionNotFoundError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    (lower.includes("session") && lower.includes("not found")) ||
    lower.includes("no session") ||
    lower.includes("session_not_found")
  );
}

/** 构造发送给后端的消息（带 [user_context] 块，仅已登录时） */
function buildOutgoingMessage(rawText: string, user: AuthUser | null): string {
  if (!user) return rawText;

  const lines: string[] = ["[user_context]"];
  lines.push(`昵称: ${user.nickname || user.username}`);
  if (user.profile?.role) lines.push(`职业: ${user.profile.role}`);
  if (user.profile?.bio) lines.push(`简介: ${user.profile.bio}`);
  if (user.globalMemories && user.globalMemories.length > 0) {
    lines.push("记忆:");
    user.globalMemories.forEach((m) => lines.push(`- ${m}`));
  }
  lines.push("[/user_context]");
  lines.push("");
  lines.push(rawText);
  return lines.join("\n");
}

interface UseChatOptions {
  agentId: string;
  /** 命名对话 ID（不传则用默认对话） */
  conversationId?: string;
}

export function useChat({ agentId, conversationId }: UseChatOptions) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    openClawClient.getState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeRunId = useRef<string | null>(null);
  const initialized = useRef(false);

  // sessionKey 依赖 user.userId（登录态）+ agentId + conversationId
  // 登录变化时 buildSessionKey 内部读取的 peerId 会变，所以把 user?.userId 加入依赖
  const sessionKey = useMemo(
    () => buildSessionKey(agentId, conversationId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId, conversationId, user?.userId],
  );

  // sessionKey 变化（agent/对话/登录态切换）→ 清空消息 + 标记需要重新初始化
  useEffect(() => {
    setMessages([]);
    initialized.current = false;
  }, [sessionKey]);

  // 订阅当前 sessionKey 的流式事件
  useEffect(() => {
    const unsubState = openClawClient.onStateChange((s) => setConnectionState(s));
    const unsubError = openClawClient.onError((e) => {
      // "session not found" 是新用户/新会话的正常状态，不弹 toast
      if (isSessionNotFoundError(e)) return;
      setError(e);
    });

    const unsubStream = openClawClient.subscribe(sessionKey, (event: StreamEvent) => {
      switch (event.kind) {
        case "delta": {
          const fullText = event.text;
          if (!fullText && !event.delta) break;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.streaming && last.id === event.runId) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: fullText || (last.content + event.delta) },
              ];
            }
            activeRunId.current = event.runId;
            return [
              ...prev,
              { id: event.runId, role: "assistant", content: fullText || event.delta, streaming: true },
            ];
          });
          break;
        }

        case "final": {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === event.runId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                content: event.text || updated[idx].content,
                streaming: false,
              };
              return updated;
            }
            if (event.text) {
              return [...prev, { id: event.runId, role: "assistant", content: event.text, streaming: false }];
            }
            return prev;
          });
          activeRunId.current = null;
          setIsGenerating(false);
          break;
        }

        case "aborted": {
          setMessages((prev) =>
            prev.map((m) => m.id === event.runId ? { ...m, streaming: false } : m),
          );
          activeRunId.current = null;
          setIsGenerating(false);
          break;
        }

        case "error": {
          const errText = event.errorMessage || "接待暂时遇到问题，请稍后再试";
          // 静默处理新会话错误
          if (!isSessionNotFoundError(errText)) {
            setError(errText);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.runId ? { ...m, content: m.content || errText, streaming: false } : m,
              ),
            );
          }
          activeRunId.current = null;
          setIsGenerating(false);
          break;
        }

        case "lifecycle": {
          if (event.phase === "end") {
            setMessages((prev) =>
              prev.map((m) => m.id === event.runId && m.streaming ? { ...m, streaming: false } : m),
            );
            if (activeRunId.current === event.runId) {
              activeRunId.current = null;
              setIsGenerating(false);
            }
          }
          break;
        }
      }
    });

    return () => {
      unsubStream();
      unsubState();
      unsubError();
    };
  }, [sessionKey]);

  /** 连接并初始化（握手 + 注入上下文 + 拉历史） */
  const initialize = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      setError(null);
      await openClawClient.connect();
      // chat.inject / chat.history 对新 sessionKey 会返 "session not found"，
      // 这是正常状态（用户还没历史），不是错误。各自单独 catch 静默。
      try {
        await openClawClient.injectVisitorContext(agentId, conversationId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (!isSessionNotFoundError(msg)) throw e;
      }
      let history: ChatMessage[] = [];
      try {
        history = await openClawClient.getHistory(agentId, 50, conversationId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (!isSessionNotFoundError(msg)) throw e;
        // 新会话没历史，当作空数组处理
      }
      const display: DisplayMessage[] = history
        .filter((m) => !isVisitorContextMessage(m) && m.role !== "system")
        // 对所有消息都跑 stripUserContext —— assistant 消息也可能被服务端
        // 内联了 [user_context]/[visitor_context]（注入残留）。
        // 剥离后内容为空的整条丢弃。
        .map((m, i) => ({
          id: `hist_${agentId}_${conversationId ?? "default"}_${i}`,
          role: m.role as "user" | "assistant",
          content: stripUserContext(m.content),
          omitted: toContentString(m.content) === "（此消息因过长已省略）",
        }))
        .filter((m) => m.content.length > 0);
      setMessages(display);
    } catch (e) {
      initialized.current = false; // 允许重试
      const msg = e instanceof Error ? e.message : "连接失败";
      if (!isSessionNotFoundError(msg)) {
        setError(msg);
      }
    }
  }, [agentId, conversationId]);

  /** 发送消息（已登录用户自动注入 [user_context] 块） */
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);

    // UI 显示原文（不带 user_context）
    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: trimmed },
    ]);

    // 发给后端的消息（已登录时前置 user_context 块）
    const outgoing = buildOutgoingMessage(trimmed, user);

    try {
      setIsGenerating(true);
      const runId = await openClawClient.sendChat(agentId, outgoing, conversationId);
      activeRunId.current = runId;
    } catch (e) {
      setIsGenerating(false);
      setError(e instanceof Error ? e.message : "发送失败");
    }
  }, [agentId, conversationId, user]);

  /** 中断生成 */
  const abortGeneration = useCallback(async () => {
    try { await openClawClient.abort(agentId, conversationId); } catch { /* ignore */ }
  }, [agentId, conversationId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    connectionState,
    error,
    isGenerating,
    initialize,
    sendMessage,
    abortGeneration,
    clearError,
    sessionKey,
  };
}
