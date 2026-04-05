/**
 * ChatWidget — 右下角灵敏 AI 聊天浮窗
 *
 * 气泡按钮 + AgentChatPanel(agentId="lingmin")
 */

import AgentChatPanel from "@/components/AgentChatPanel";
import { MessageCircle } from "lucide-react";
import { useState } from "react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 气泡按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="chat-fab fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95"
          aria-label="打开聊天"
        >
          <MessageCircle className="size-6 text-white" />
        </button>
      )}

      <AgentChatPanel
        agentId="lingmin"
        agentName="灵敏 AI"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
