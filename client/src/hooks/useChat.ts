/**
 * useChat — 参数化聊天状态管理 hook（多智能体版）
 *
 * 用法：const { messages, sendMessage, ... } = useChat({ agentId: "lingmin" });
 *
 * 每个 agentId 的消息状态独立。
 * 所有 agent 共用模块级单例 OpenClawClient（同一条 WebSocket）。
 * 通过 sessionKey 订阅/取消订阅事件流。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatMessage,
  type ConnectionState,
  type StreamEvent,
  openClawClient,
} from "@/lib/openclaw";
import { buildSessionKey } from "@/lib/visitor";

/** 前端展示用的消息结构 */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  omitted?: boolean;
}

/** 判断一条 assistant 消息是否为隐藏的访客上下文注入 */
function isVisitorContextMessage(msg: ChatMessage): boolean {
  return msg.role === "assistant" && msg.content.startsWith("访客上下文:");
}

interface UseChatOptions {
  agentId: string;
}

export function useChat({ agentId }: UseChatOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    openClawClient.getState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeRunId = useRef<string | null>(null);
  const initialized = useRef(false);
  const sessionKey = buildSessionKey(agentId);

  useEffect(() => {
    // 全局状态监听（只注册一次，多个 hook 实例会覆盖，但值一样）
    openClawClient.onStateChange((s) => setConnectionState(s));
    openClawClient.onError((e) => setError(e));

    // 按 sessionKey 订阅流式事件
    const unsubscribe = openClawClient.subscribe(sessionKey, (event: StreamEvent) => {
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
          setError(errText);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.runId ? { ...m, content: m.content || errText, streaming: false } : m,
            ),
          );
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
      unsubscribe();
    };
  }, [sessionKey]);

  /** 连接并初始化（握手 + 注入上下文 + 拉历史） */
  const initialize = useCallback(async () => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      setError(null);
      await openClawClient.connect();
      await openClawClient.injectVisitorContext(agentId);
      const history = await openClawClient.getHistory(agentId);
      const display: DisplayMessage[] = history
        .filter((m) => !isVisitorContextMessage(m) && m.role !== "system")
        .map((m, i) => ({
          id: `hist_${agentId}_${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          omitted: m.content === "（此消息因过长已省略）",
        }));
      setMessages(display);
    } catch (e) {
      initialized.current = false; // 允许重试
      setError(e instanceof Error ? e.message : "连接失败");
    }
  }, [agentId]);

  /** 发送消息 */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);

    const userMsgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text.trim() },
    ]);

    try {
      setIsGenerating(true);
      const runId = await openClawClient.sendChat(agentId, text.trim());
      activeRunId.current = runId;
    } catch (e) {
      setIsGenerating(false);
      setError(e instanceof Error ? e.message : "发送失败");
    }
  }, [agentId]);

  /** 中断生成 */
  const abortGeneration = useCallback(async () => {
    try { await openClawClient.abort(agentId); } catch { /* ignore */ }
  }, [agentId]);

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
  };
}
