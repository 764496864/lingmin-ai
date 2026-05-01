/**
 * AgentChatPanel — 通用智能体对话面板（多对话版）
 *
 * - 桌面端用 Sheet，移动端用 Drawer
 * - 已登录用户顶部显示对话切换下拉 + "新建对话"按钮
 * - 切换对话时，useChat 自动重新订阅 + 重新初始化历史
 */

import ChatInput from "@/components/ChatInput";
import ChatMessages from "@/components/ChatMessages";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/hooks/useChat";
import { useIsMobile } from "@/hooks/useMobile";
import { type ChatSessionInfo, listChatSessions } from "@/lib/auth";
import { Bot, Maximize2, MessageSquarePlus, Minimize2, Plus, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const { user, sessionToken } = useAuth();
  const initRef = useRef(false);

  // 当前选中的对话 ID（undefined = 默认对话）
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  // 当前 agent 的对话列表（仅已登录时有意义）
  const [conversations, setConversations] = useState<ChatSessionInfo[]>([]);
  // 桌面端全屏切换（移动端始终满屏 Drawer，无需此 state）
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    messages,
    connectionState,
    error,
    isGenerating,
    initialize,
    sendMessage,
    abortGeneration,
    clearError,
  } = useChat({ agentId, conversationId });

  // 打开 + sessionKey 变化时初始化（initialize 自身在 conversationId/agentId 变化时会换新身份）
  useEffect(() => {
    if (open) {
      initialize();
    }
  }, [open, initialize]);

  // 已登录时，打开后拉对话列表
  useEffect(() => {
    if (!open || !user || !sessionToken) {
      return;
    }
    let cancelled = false;
    listChatSessions(sessionToken)
      .then((list) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.log(`[AgentChatPanel] sessions.list (agentId=${agentId}):`, list);
        }
        // 兼容服务端返回 { sessions: [...] } 包装的情况
        const arr = Array.isArray(list)
          ? list
          : (list as { sessions?: unknown })?.sessions ?? [];
        const safeArr = Array.isArray(arr) ? arr : [];
        setConversations(safeArr.filter((c) => c.agentId === agentId));
      })
      .catch((e) => {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn("[AgentChatPanel] sessions.list failed:", e);
        }
        // 对话列表 RPC 失败不影响主流程，静默；保持 conversations=[]
      });
    return () => {
      cancelled = true;
    };
  }, [open, user, sessionToken, agentId]);

  // 用户登出时退回默认对话
  useEffect(() => {
    if (!user) {
      setConversationId(undefined);
      setConversations([]);
    }
  }, [user]);

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

  const handleNewConversation = useCallback(() => {
    const newId = crypto.randomUUID();
    setConversationId(newId);
    toast.success("已创建新对话");
  }, []);

  const handleSwitchConversation = useCallback((value: string) => {
    setConversationId(value === "__default__" ? undefined : value);
  }, []);

  // 错误提示
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // 标记初始化已发生（用于断线 banner 显示时机）
  useEffect(() => {
    if (open) initRef.current = true;
  }, [open]);

  const isDisconnected = connectionState === "disconnected" || connectionState === "error";
  const isConnecting = connectionState === "connecting";

  // 对话切换栏（仅已登录且确实有历史对话时显示；新用户/空数据时隐藏）
  const conversationBar = user && conversations.length > 0 ? (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-[oklch(0.1_0.02_260/0.6)]">
      <Select
        value={conversationId ?? "__default__"}
        onValueChange={handleSwitchConversation}
      >
        <SelectTrigger
          size="sm"
          className="flex-1 bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] text-xs"
        >
          <SelectValue placeholder="选择对话" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">默认对话</SelectItem>
          {conversations.map((c) => {
            const id = c.conversationId ?? c.sessionKey;
            const label =
              c.title ||
              `对话 ${id.substring(0, 8)} · ${c.messageCount ?? 0} 条`;
            return (
              <SelectItem key={id} value={c.conversationId ?? id}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleNewConversation}
        className="shrink-0 text-xs text-[oklch(0.75_0.18_255)] hover:bg-[oklch(0.55_0.18_255)]/10"
      >
        <Plus className="size-3.5" />
        新对话
      </Button>
    </div>
  ) : null;

  // 面板内容（Sheet 和 Drawer 共用）
  const chatPanel = (
    <div className="flex flex-col h-full">
      {conversationBar}
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

  // 面板头部（左侧 Logo+品牌；桌面端右侧加全屏切换按钮）
  const panelHeader = (
    <div className="flex items-center justify-between flex-1 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-star-blue)]/15 flex items-center justify-center">
          <Bot className="size-4 text-[var(--color-star-blue)]" />
        </div>
        <div>
          <div className="font-display font-semibold text-foreground text-sm">{agentName}</div>
          <div className="text-[11px] text-muted-foreground">AI 助手</div>
        </div>
      </div>

      {/* 头部按钮：新建对话（移动端 + 桌面端都显示）+ 全屏切换（仅桌面端） */}
      <div className={`flex items-center gap-1 ${isMobile ? "" : "mr-8"}`}>
        <button
          type="button"
          onClick={handleNewConversation}
          className="p-1.5 rounded-lg hover:bg-[oklch(0.15_0.02_260)] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="新建对话"
          title="新建对话"
        >
          <MessageSquarePlus className="size-4" />
        </button>
        {!isMobile && (
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[oklch(0.15_0.02_260)] text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isFullscreen ? "缩小" : "全屏"}
            title={isFullscreen ? "缩小" : "全屏"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        )}
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
            className={`${
              isFullscreen
                ? "w-screen sm:max-w-none"
                // 平板（768-1023）用更宽的 50vw；桌面（1024+）固定 420px
                : "w-[420px] sm:max-w-[50vw] lg:max-w-[420px]"
            } p-0 gap-0 bg-[var(--color-void)] border-l-border/30 transition-all duration-300`}
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
          <DrawerContent className="max-h-[90vh] bg-[var(--color-void)]">
            <DrawerHeader className="pb-2 border-b border-border/30 shrink-0">
              <DrawerTitle className="sr-only">{agentName} 聊天</DrawerTitle>
              <div className="flex items-center justify-between gap-2">
                {panelHeader}
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground p-1 shrink-0"
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>
            </DrawerHeader>
            {/* 输入框 + 消息列表占满剩余高度，Drawer 自身有 max-h-[90vh] */}
            <div className="flex-1 overflow-hidden min-h-0" style={{ height: "calc(90vh - 4rem)" }}>
              {chatPanel}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
