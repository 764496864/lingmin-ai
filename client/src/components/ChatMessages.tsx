/**
 * ChatMessages — 聊天消息列表
 *
 * - 用户消息右对齐蓝色气泡，AI 消息左对齐深色气泡
 * - 流式消息显示打字光标动画
 * - 自动滚动到底部
 * - 被截断���消息显示为灰色占位
 * - 空态显示欢迎语
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { DisplayMessage } from "@/hooks/useChat";
import { Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";

interface ChatMessagesProps {
  messages: DisplayMessage[];
  isGenerating: boolean;
}

function WelcomeState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--color-card)] border border-border/50 flex items-center justify-center">
        <Bot className="size-6 text-[var(--color-star-blue)]" />
      </div>
      <h3 className="font-display font-semibold text-foreground text-base">
        灵敏 AI
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px]">
        有什么可以帮到你的？随时开始对话
      </p>
    </div>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback
          className={
            isUser
              ? "bg-[var(--color-star-blue)]/20 text-[var(--color-star-blue)]"
              : "bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
          }
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      {/* Bubble */}
      <div
        className={`
          relative max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${
            isUser
              ? "bg-[var(--color-star-blue)] text-white rounded-br-md"
              : "bg-[var(--color-card)] text-foreground border border-border/30 rounded-bl-md"
          }
          ${msg.omitted ? "opacity-50 italic" : ""}
        `}
      >
        {/* 消息内容，保留换行 */}
        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
        {/* 流式打字光标 */}
        {msg.streaming && (
          <span className="chat-typing-cursor" />
        )}
      </div>
    </div>
  );
}

export default function ChatMessages({ messages, isGenerating }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="flex flex-col gap-3 p-4 min-h-full">
        {messages.length === 0 && !isGenerating ? (
          <WelcomeState />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {/* 等待 AI 首个 delta 时的加载指示器 */}
            {isGenerating && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2.5">
                <Avatar className="size-7 shrink-0 mt-0.5">
                  <AvatarFallback className="bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
                    <Bot className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-[var(--color-card)] border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
                  <Spinner className="size-4 text-muted-foreground" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
