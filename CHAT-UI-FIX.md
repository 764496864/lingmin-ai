# Code 指令：聊天界面优化（4 个问题）

> 把这段完整发给 Claude Code。

---

## 背景

这是一个 React + Vite 前端项目，聊天功能通过 WebSocket 连接 OpenClaw Gateway（一个 AI 对话引擎）。
聊天组件在 `client/src/components/AgentChatPanel.tsx`。
WebSocket 客户端在 `client/src/lib/openclaw.ts`。
聊天 hook 在 `client/src/hooks/useChat.ts`。

## 问题 1：AI 回复有 Markdown 原文混在里面

AI 回复的内容包含 Markdown 格式（**加粗**、## 标题、- 列表、```代码块``` 等），但前端直接用纯文本显示，用户看到的是原始 Markdown 符号。

**修法**：
1. 安装 `react-markdown` 和 `remark-gfm`：`pnpm add react-markdown remark-gfm`
2. 在 `AgentChatPanel.tsx` 里，AI 消息的渲染部分，把纯文本显示改成 `<ReactMarkdown>` 组件
3. 给 Markdown 渲染加基础样式（prose 类，用 Tailwind 的 `@tailwindcss/typography` 已经装了）
4. 代码块要有背景色和等宽字体
5. 用户消息不需要 Markdown 渲染，保持纯文本

示例：
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// AI 消息渲染
<div className="prose prose-invert prose-sm max-w-none">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {message.content}
  </ReactMarkdown>
</div>
```

## 问题 2：不是流式回复（一次性显示）

目前 AI 回复可能等全部生成完才显示，用户体验很差。

**检查并修复**：
1. 看 `useChat.ts` 里的 `StreamEvent` 处理——`kind: "delta"` 事件应该实时追加文本到当前消息
2. 确认 `AgentChatPanel.tsx` 在收到 delta 时立刻 re-render（不是等 final 才显示）
3. 流式过程中显示一个闪烁的光标或 "..." 动画
4. 确认 `openclaw.ts` 的 `handleAgentEvent` 方法正确分发 delta 事件

如果流式已经实现但视觉上看不出来，可能是因为 React 批量更新导致的。确保每个 delta 都触发独立的 state 更新：
```tsx
setMessages(prev => {
  const last = prev[prev.length - 1];
  if (last && last.role === 'assistant') {
    return [...prev.slice(0, -1), { ...last, content: last.content + event.delta }];
  }
  return [...prev, { role: 'assistant', content: event.delta }];
});
```

## 问题 3：聊天面板加"全屏/宽屏"按钮

右上角加一个展开按钮，点了之后聊天面板变成全屏宽屏模式，再点收回来。

**修法**：
1. 在 `AgentChatPanel.tsx` 的顶部栏加一个全屏切换按钮
2. 使用 `lucide-react` 的 `Maximize2` 和 `Minimize2` 图标
3. 全屏模式：fixed 定位，覆盖整个视口，z-index 高于其他内容
4. 加过渡动画

## 问题 4：错误处理优化

聊天过程中经常弹错误提示（"session not found"、"连接已断开"等），体验差。

**修法**：
1. "session not found" 错误：不弹 toast，自动重新创建 session 静默重连
2. "连接已断开"：显示小的重连状态条，不弹 toast，自动重连中显示"正在重连..."
3. WebSocket 断开时不弹错误，只在连接状态栏显示
4. 只有真正影响用户操作的错误才弹 toast
5. 检查所有 setError 和 toast 调用，按以上规则分类处理

---

做完后跑 `npx tsc --noEmit` 确认零错误，`pnpm build` 确认构建通过。commit + push。
