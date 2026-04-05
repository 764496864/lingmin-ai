/**
 * ChatWidget — 右下角聊天浮窗
 *
 * - 桌面端：右下角气泡按钮 + Sheet 侧边抽屉
 * - 移动端：右下角气泡按钮 + Drawer 底部抽屉
 * - 关闭后消息保留（useChat 状态不随 unmount 丢失）
 * - 气泡按钮使用品牌星河蓝 + 脉冲发光效果
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
import { Bot, MessageCircle, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
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
  } = useChat();

  // 首次打开时连接 + 初始化
  const handleOpen = useCallback(() => {
    setOpen(true);
    if (!initRef.current) {
      initRef.current = true;
      initialize();
    }
  }, [initialize]);

  // 发���消息前检查连接状态
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

  // 错误提示（在 effect 中执行，避免 render 中调用副作用）
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const isDisconnected = connectionState === "disconnected" || connectionState === "error";
  const isConnecting = connectionState === "connecting";

  // 聊天面板内容（Sheet 和 Drawer 共用）
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* 连接状态横幅 */}
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

      {/* 消息列表 */}
      <ChatMessages messages={messages} isGenerating={isGenerating} />

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        onAbort={abortGeneration}
        isGenerating={isGenerating}
        disabled={isDisconnected}
      />
    </div>
  );

  // 面板头部（共用）
  const panelHeader = (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-star-blue)]/15 flex items-center justify-center">
        <Bot className="size-4 text-[var(--color-star-blue)]" />
      </div>
      <div>
        <div className="font-display font-semibold text-foreground text-sm">灵敏 AI</div>
        <div className="text-[11px] text-muted-foreground">文案创作助手</div>
      </div>
    </div>
  );

  return (
    <>
      {/* 气泡按钮 */}
      {!open && (
        <button
          onClick={handleOpen}
          className="chat-fab fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95"
          aria-label="打开聊天"
        >
          <MessageCircle className="size-6 text-white" />
        </button>
      )}

      {/* 桌面端 Sheet */}
      {!isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-[400px] sm:max-w-[400px] p-0 gap-0 bg-[var(--color-void)] border-l-border/30"
          >
            <SheetHeader className="p-4 pb-3 border-b border-border/30">
              <SheetTitle className="sr-only">灵敏 AI 聊天</SheetTitle>
              <SheetDescription className="sr-only">与灵敏 AI 文案创作助手对话</SheetDescription>
              {panelHeader}
            </SheetHeader>
            {chatPanel}
          </SheetContent>
        </Sheet>
      )}

      {/* 移动端 Drawer */}
      {isMobile && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh] bg-[var(--color-void)]">
            <DrawerHeader className="pb-2 border-b border-border/30">
              <DrawerTitle className="sr-only">灵敏 AI 聊天</DrawerTitle>
              <div className="flex items-center justify-between">
                {panelHeader}
                <button
                  onClick={() => setOpen(false)}
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
