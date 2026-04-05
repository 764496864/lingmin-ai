/**
 * ChatInput — 聊天输入区域
 *
 * - textarea 自适应高度
 * - Enter 发送，Shift+Enter 换行
 * - 中文输入法状态下 Enter 不触发发送（useComposition）
 * - 生成中显示停止按钮
 */

import { Button } from "@/components/ui/button";
import { useComposition } from "@/hooks/useComposition";
import { ArrowUp, Square } from "lucide-react";
import { useRef } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onAbort, isGenerating, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const composition = useComposition<HTMLTextAreaElement>({
    onKeyDown: (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
  });

  const handleSend = () => {
    const el = textareaRef.current;
    if (!el || isGenerating || disabled) return;
    const text = el.value.trim();
    if (!text) return;
    onSend(text);
    el.value = "";
    el.style.height = "auto";
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t border-border/50">
      <textarea
        ref={textareaRef}
        placeholder="输入消息..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none max-h-[120px] py-2 px-1 leading-relaxed"
        onInput={handleInput}
        onCompositionStart={composition.onCompositionStart}
        onCompositionEnd={composition.onCompositionEnd}
        onKeyDown={composition.onKeyDown}
      />
      {isGenerating ? (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onAbort}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="停止生成"
        >
          <Square className="size-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={disabled}
          className="shrink-0 bg-[var(--color-star-blue)] hover:bg-[var(--color-star-blue-bright)] text-white rounded-lg"
          aria-label="发送"
        >
          <ArrowUp className="size-4" />
        </Button>
      )}
    </div>
  );
}
