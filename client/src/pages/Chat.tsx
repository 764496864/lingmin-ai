/**
 * Chat — 独立全屏聊天页面
 *
 * URL: /chat/:agentId?  （默认 lingmin）
 * 用法：从 AgentChatPanel 的"新窗口"按钮 window.open() 打开。
 *
 * 不依赖站点 Navbar/Footer，自己渲染极简头部，专注对话体验。
 */

import ChatInput from "@/components/ChatInput";
import ChatMessages from "@/components/ChatMessages";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/hooks/useChat";
import { useCallback, useEffect } from "react";
import { Bot, WifiOff } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const AGENT_LABELS: Record<string, string> = {
  lingmin: "灵敏 AI",
  copywriter: "文案创作官",
  "content-doctor": "文案润色官",
};

export default function Chat() {
  const { agentId: rawAgentId } = useParams<{ agentId?: string }>();
  const agentId = rawAgentId || "lingmin";
  const agentName = AGENT_LABELS[agentId] || agentId;

  // 独立页面默认走默认对话；本期不做对话切换
  const {
    messages,
    connectionState,
    error,
    isGenerating,
    initialize,
    sendMessage,
    abortGeneration,
    clearError,
  } = useChat({ agentId });

  const { user } = useAuth();

  // 进入页面立即初始化
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleSend = useCallback(
    (text: string) => {
      if (connectionState !== "connected") {
        toast.error("接待暂时不在线，请稍后再试");
        return;
      }
      sendMessage(text);
    },
    [connectionState, sendMessage],
  );

  // 错误浮窗
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const isDisconnected =
    connectionState === "disconnected" || connectionState === "error";
  const isConnecting = connectionState === "connecting";

  return (
    <div
      className="h-screen flex flex-col bg-[var(--color-void)] text-foreground"
      style={{ height: "100dvh" }}
    >
      {/* 顶部极简头部 */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30 bg-[oklch(0.1_0.02_260/0.6)] backdrop-blur shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--color-star-blue)]/15 flex items-center justify-center">
            <Bot className="size-4 text-[var(--color-star-blue)]" />
          </div>
          <div>
            <div className="font-display font-semibold text-foreground text-sm">{agentName}</div>
            <div className="text-[11px] text-muted-foreground">
              {user ? user.nickname || user.username : "AI 助手"}
            </div>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          返回首页 →
        </Link>
      </header>

      {/* 连接状态横幅 */}
      {isDisconnected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-xs shrink-0">
          <WifiOff className="size-3" />
          <span>连接已断开，正在重连...</span>
        </div>
      )}
      {isConnecting && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-star-blue)]/10 text-[var(--color-star-blue)] text-xs shrink-0">
          <span className="size-2 rounded-full bg-current animate-pulse" />
          <span>正在连接...</span>
        </div>
      )}

      {/* 消息区 + 输入框：占满剩余高度 */}
      <main className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto">
        <ChatMessages messages={messages} isGenerating={isGenerating} />
        <ChatInput
          onSend={handleSend}
          onAbort={abortGeneration}
          isGenerating={isGenerating}
          disabled={isDisconnected}
        />
      </main>
    </div>
  );
}
