/**
 * useChat — 聊天状态管理 hook
 *
 * 封装 OpenClawClient，提供：
 * - 消息列表（含流式 delta 实时拼接）
 * - 发送/中断/拉取历史
 * - 连接状态
 * - 错误提示
 *
 * 流式策略：
 * - agent 事件的 text 字段是累积全文，每次直接覆盖（不 append）
 * - chat 聚合事件的 final 用于收尾（停止 streaming 状态）
 *
 * 单例 client 在模块级创建，组件 unmount 不断连。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatMessage,
  type ConnectionState,
  OpenClawClient,
  type StreamEvent,
} from "@/lib/openclaw";

const client = new OpenClawClient();

/** 前端展示用的消息结构 */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 是否正在流式生成中 */
  streaming?: boolean;
  /** 是否被截断的占位消息 */
  omitted?: boolean;
}

/** 判断一条 assistant 消息是否为隐藏的访客上下文注入 */
function isVisitorContextMessage(msg: ChatMessage): boolean {
  return msg.role === "assistant" && msg.content.startsWith("访客上下文:");
}

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeRunId = useRef<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    client.onStateChange((s) => setConnectionState(s));
    client.onError((e) => setError(e));

    client.onMessage((event: StreamEvent) => {
      switch (event.kind) {
        case "delta": {
          // agent 事件：text 是累积全文，直接覆盖
          const fullText = event.text;
          if (!fullText && !event.delta) break;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.streaming && last.id === event.runId) {
              // 用累积全文覆盖（比 append delta 更可靠，不丢不重复）
              return [
                ...prev.slice(0, -1),
                { ...last, content: fullText || (last.content + event.delta) },
              ];
            }
            // 新的 streaming 消息
            activeRunId.current = event.runId;
            return [
              ...prev,
              {
                id: event.runId,
                role: "assistant",
                content: fullText || event.delta,
                streaming: true,
              },
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
                // final 带的 text 是完整文本，用于校准
                content: event.text || updated[idx].content,
                streaming: false,
              };
              return updated;
            }
            // 没有对应的 delta（极端情况），直接插入
            if (event.text) {
              return [
                ...prev,
                { id: event.runId, role: "assistant", content: event.text, streaming: false },
              ];
            }
            return prev;
          });
          activeRunId.current = null;
          setIsGenerating(false);
          break;
        }

        case "aborted": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === event.runId ? { ...m, streaming: false } : m,
            ),
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
              m.id === event.runId
                ? { ...m, content: m.content || errText, streaming: false }
                : m,
            ),
          );
          activeRunId.current = null;
          setIsGenerating(false);
          break;
        }

        case "lifecycle": {
          // lifecycle start → 开始生成指示器已经由 sendMessage 设置
          // lifecycle end → 如果 final 没到，也收尾
          if (event.phase === "end") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === event.runId && m.streaming ? { ...m, streaming: false } : m,
              ),
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
  }, []);

  /** 连接并初始化（握手 + 注入上下文 + 拉历史） */
  const initialize = useCallback(async () => {
    try {
      setError(null);
      await client.connect();
      await client.injectVisitorContext();
      const history = await client.getHistory();
      const display: DisplayMessage[] = history
        .filter((m) => !isVisitorContextMessage(m) && m.role !== "system")
        .map((m, i) => ({
          id: `hist_${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
          omitted: m.content === "（此消息因过长已省略）",
        }));
      setMessages(display);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    }
  }, []);

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
      const runId = await client.sendChat(text.trim());
      activeRunId.current = runId;
    } catch (e) {
      setIsGenerating(false);
      setError(e instanceof Error ? e.message : "发送失败");
    }
  }, []);

  /** 中断生成 */
  const abortGeneration = useCallback(async () => {
    try { await client.abort(); } catch { /* ignore */ }
  }, []);

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
