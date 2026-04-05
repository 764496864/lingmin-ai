/**
 * AgentChatPanel — 通用智能体对话面板
 *
 * 所有入口（灵敏浮窗 / 文案创作官 / 文案润色官）共用此组件。
 * 桌面端用 Sheet，移动端用 Drawer。
 */

import ChatInput from "@/components/ChatInput";
import ChatMessages from "@/components/ChatMessages";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChat } from "@/hooks/useChat";
import { useIsMobile } from "@/hooks/useMobile";
import { Bot, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface AgentChatPanelProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AgentChatPanel({
  agentId,
  agentName,
  open,
  onOpenChange,
}: AgentChatPanelProps) {
  const isMobile = useIsMobile();
  const initRef = useRef(false);

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

  // 首次打开时连接 + 初始化
  useEffect(() => {
    if (open && !initRef.current) {
      initRef.current = true;
      initialize();
    }
  }, [open, initialize]);

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

  // 错误提示
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const isDisconnected = connectionState === "disconnected" || connectionState === "error";
  const isConnecting = connectionState === "connecting";

  // 面板内容（Sheet 和 Drawer 共用）
  const chatPanel = (
    <div className="flex flex-col h-full">
      {isDisconnected && initRef.current && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-xs">
          <WifiOff className="size-3" />
          <span>连接已断开，正在重连...</span>
        </div>
      )}
      {isConnecting && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-star-blue)]/10 text-[var(--color-star-blue)] text-xs">
          <span className="size-2 rounded-full bg-current animate-pulse" />
          <span>正在连接...</span>
        </div>
      )}
      <ChatMessages messages={messages} isGenerating={isGenerating} />
      <ChatInput
        onSend={handleSend}
        onAbort={abortGeneration}
        isGenerating={isGenerating}
        disabled={isDisconnected}
      />
    </div>
  );

  // 面板头部
  const panelHeader = (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-star-blue)]/15 flex items-center justify-center">
        <Bot className="size-4 text-[var(--color-star-blue)]" />
      </div>
      <div>
        <div className="font-display font-semibold text-foreground text-sm">{agentName}</div>
        <div className="text-[11px] text-muted-foreground">AI 助手</div>
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端 Sheet */}
      {!isMobile && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="right"
            className="w-[400px] sm:max-w-[400px] p-0 gap-0 bg-[var(--color-void)] border-l-border/30"
          >
            <SheetHeader className="p-4 pb-3 border-b border-border/30">
              <SheetTitle className="sr-only">{agentName} 聊天</SheetTitle>
              <SheetDescription className="sr-only">与{agentName}对话</SheetDescription>
              {panelHeader}
            </SheetHeader>
            {chatPanel}
          </SheetContent>
        </Sheet>
      )}

      {/* 移动端 Drawer */}
      {isMobile && (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[85vh] bg-[var(--color-void)]">
            <DrawerHeader className="pb-2 border-b border-border/30">
              <DrawerTitle className="sr-only">{agentName} 聊天</DrawerTitle>
              <div className="flex items-center justify-between">
                {panelHeader}
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>
            </DrawerHeader>
            <div className="flex-1 overflow-hidden" style={{ height: "60vh" }}>
              {chatPanel}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
