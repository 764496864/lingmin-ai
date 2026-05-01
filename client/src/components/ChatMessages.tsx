/**
 * ChatMessages — 聊天消息列表
 *
 * - 用户消息右对齐蓝色气泡（纯文本，保留换行）
 * - AI 消息左对齐深色气泡（react-markdown 渲染粗体/列表/标题/代码块）
 * - 流式消息显示打字光标动画
 * - 等待 AI 首个 delta 时显示三个跳动的点
 * - 自动滚动到底部
 * - 被截断的消息显示为灰色占位
 * - 空态显示欢迎语
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DisplayMessage } from "@/hooks/useChat";
import { Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

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

/** 防御：把任意类型的 content 安全转成字符串渲染 */
function safeContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
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
  if (typeof content === "object" && typeof (content as { text?: unknown }).text === "string") {
    return (content as { text: string }).text;
  }
  return String(content);
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === "user";
  // 始终走 safeContent，避免 lobster 偶尔返非字符串 content 导致崩溃
  const text = safeContent(msg.content);

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
        {/* 用户消息：纯文本；AI 消息：Markdown 渲染 */}
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">{text}</span>
        ) : (
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-headings:my-2 prose-headings:font-semibold
              prose-ul:my-1 prose-ol:my-1
              prose-li:my-0.5
              prose-strong:text-foreground
              prose-code:text-[oklch(0.75_0.18_255)] prose-code:bg-[oklch(0.15_0.02_260)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-[oklch(0.12_0.02_260)] prose-pre:rounded-lg prose-pre:my-2
              break-words"
          >
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
        {/* 流式打字光标 */}
        {msg.streaming && <span className="chat-typing-cursor" />}
      </div>
    </div>
  );
}

/** 等待 AI 首个 delta 时的"三点跳动" */
function TypingDots() {
  return (
    <div className="flex gap-2.5">
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback className="bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-[var(--color-card)] border border-border/30 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5 items-center">
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
          <span className="text-xs text-muted-foreground/60 ml-1.5">正在思考...</span>
        </div>
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
            {/* 等待 AI 首个 delta 时的加载指示器（三点跳动） */}
            {isGenerating && messages[messages.length - 1]?.role === "user" && (
              <TypingDots />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
