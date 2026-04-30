# CLAUDE.md — 灵敏AI 前端开发指令

## 项目概述

灵敏AI 官网，React + Vite + TypeScript + Tailwind + shadcn/ui + wouter。
当前状态：首页已完成（Hero/工具/流程/优势/Coming Soon/微信/Footer），聊天浮窗能连 OpenClaw。
需要加：用户系统 + 个人中心 + 多对话管理 + 管理后台。

## 技术栈

- 前端框架：React 19 + TypeScript
- 构建：Vite 7
- 样式：Tailwind 4 + shadcn/ui
- 路由：wouter
- 状态：React hooks（无全局状态库）
- 后端通信：WebSocket（OpenClaw 协议）
- 环境变量：`VITE_OPENCLAW_WS_URL`（.env.local）

## 已有的关键代码

| 文件 | 作用 |
|------|------|
| `lib/openclaw.ts` | WebSocket 客户端单例，管连接/握手/收发 |
| `lib/visitor.ts` | 访客 ID 管理（localStorage） |
| `hooks/useChat.ts` | 多智能体聊天状态 hook |
| `components/AgentChatPanel.tsx` | 通用聊天面板（Sheet/Drawer） |
| `components/ChatWidget.tsx` | 右下角聊天浮窗 |

## 要做的事（按优先级）

### 第一步：用户认证系统

**原理**：通过 WebSocket 调龙虾的 daoxu-auth plugin 的 RPC 方法。不走 HTTP API。

创建 `lib/auth.ts`：

```typescript
// 认证 SDK —— 通过 WebSocket RPC 调用龙虾的 daoxu-auth plugin
// RPC 调用方式：往 session=agent:main:auth-rpc 的 WebSocket 发消息
// 消息格式：{ type: "chat.send", message: "/rpc <method> <jsonPayload>" }
// 响应在 chat 事件里返回 JSON 字符串

interface AuthUser {
  userId: string;
  username: string;
  nickname?: string;
  profile?: {
    role?: string;      // 职业
    bio?: string;       // 简介
    contact?: string;   // 联系方式
  };
  globalMemories?: string[];  // 用户记忆（最多50条）
  stats?: {
    conversationsTotal: number;
    tokensIn: number;
    tokensOut: number;
  };
  createdAt: string;
  lastLoginAt: string;
}

// 方法列表：
// daoxu.user.register({ username, password, securityQuestion, securityAnswer })
// daoxu.user.login({ username, password }) → { sessionToken, user }
// daoxu.user.logout({ sessionToken })
// daoxu.user.me({ sessionToken }) → AuthUser
// daoxu.profile.update({ sessionToken, nickname?, profile? })
// daoxu.memory.set({ sessionToken, memories: string[] })
// daoxu.stats.me({ sessionToken }) → 使用统计
// daoxu.chat.sessions.list({ sessionToken }) → 对话列表
// daoxu.chat.history_v2({ sessionToken, sessionKey }) → 对话详情
// daoxu.user.recover({ username, securityAnswer, newPassword })
```

- sessionToken 存 localStorage
- 创建 `contexts/AuthContext.tsx` 全局提供登录状态
- 登录后 `visitor.ts` 的 visitorId 切换成 userId

### 第二步：登录/注册页面

创建 3 个页面：

**`pages/Login.tsx`**
- 用户名 + 密码输入
- "登录"按钮
- 底部链接："没有账号？立即注册" / "忘记密码？"
- 登录成功跳转首页
- 视觉风格跟首页一致（暗色主题，星河蓝色调）

**`pages/Register.tsx`**
- 用户名 + 密码 + 确认密码 + 安全问题 + 安全答案
- "注册"按钮
- 注册成功自动登录并跳转首页

**`pages/Recover.tsx`**
- 用户名 + 安全问题验证 + 新密码
- 验证通过重置密码

路由加到 `App.tsx`：
```typescript
<Route path="/login" component={Login} />
<Route path="/register" component={Register} />
<Route path="/recover" component={Recover} />
```

### 第三步：用户上下文注入

登录后，`sendMessage` 里自动注入 `[user_context]`：

改 `hooks/useChat.ts` 的 `sendMessage`：
```typescript
const sendMessage = useCallback(async (text: string) => {
  const user = authContext.user; // 从 AuthContext 拿
  let msg = text.trim();
  
  if (user) {
    let ctx = '[user_context]\n';
    ctx += `昵称: ${user.nickname || user.username}\n`;
    if (user.profile?.role) ctx += `职业: ${user.profile.role}\n`;
    if (user.globalMemories?.length) {
      ctx += '记忆:\n' + user.globalMemories.map(m => `- ${m}`).join('\n') + '\n';
    }
    ctx += '[/user_context]\n\n';
    msg = ctx + msg;
  }
  
  // ... 发送 msg
}, [agentId, authContext]);
```

改 `visitor.ts` 的 `buildSessionKey`：
- 已登录用户用 userId 替代 visitorId
- session key 变成 `agent:<agentId>:webchat:direct:<userId>`

### 第四步：个人中心页面

**`pages/Profile.tsx`**（需要登录才能访问）

分 4 个 Tab：

**Tab 1 — 个人资料**
- 头像（默认头像）/ 昵称 / 职业 / 简介 / 联系方式
- "保存"按钮 → 调 `daoxu.profile.update`

**Tab 2 — 我的记忆**
- 记忆列表（最多 50 条，每条最多 300 字）
- 可添加 / 编辑 / 删除
- "保存"按钮 → 调 `daoxu.memory.set`
- 提示文案："这些记忆会帮助 AI 更好地了解你，所有智能体共享"

**Tab 3 — 使用统计**
- 总对话轮次
- 总 Token 消耗（input + output）
- 费用折算（按模型单价计算，显示 ¥XX.XX）
- 按智能体分布的使用量（柱状图或饼图，用 recharts）
- 数据来源：`daoxu.stats.me`

**Tab 4 — 对话历史**
- 按智能体 × 时间排列的对话列表
- 点击展开查看对话内容
- 可以新建对话 / 删除对话
- 数据来源：`daoxu.chat.sessions.list` + `daoxu.chat.history_v2`

### 第五步：多对话管理

在 AgentChatPanel 里加"对话管理"：

- 顶部加一个下拉菜单，显示当前智能体的所有对话
- "新建对话"按钮 → 生成新的 conversationId → 新的 session key
- 切换对话 → 重新连接对应的 session → 加载历史
- session key 格式：`agent:<agentId>:webchat:direct:<userId>:<conversationId>`

### 第六步：管理后台

**`pages/Admin.tsx`**（需要管理员权限才能访问）

**用户管理面板**：
- 用户列表（表格：昵称/用户名/注册时间/最后登录/对话数/Token量/费用）
- 搜索 / 按状态筛选
- 点击用户 → 展开详情（完整资料/记忆/使用统计/对话列表）
- 数据来源：`daoxu.admin.users.list` + `daoxu.admin.user.get`

**数据面板**：
- 今日活跃用户数
- 今日新注册用户数
- 今日总对话轮次 / Token 消耗
- 按智能体分布的使用量
- 用 recharts 做图表

**路由**：
```typescript
<Route path="/admin" component={Admin} />
```

### 第七步：导航栏更新

改 `Navbar.tsx`：
- 未登录：右上角显示"登录"按钮（替换现在的"立即体验"）
- 已登录：右上角显示用户头像/昵称，点击下拉菜单：
  - 个人中心
  - 管理后台（仅管理员可见）
  - 退出登录

## 设计约束

- 保持现有暗色主题风格（`--color-void` 背景，`--color-star-blue` 强调色）
- 所有新页面跟首页视觉风格一致
- 使用 shadcn/ui 组件（已安装）
- 表单用 react-hook-form + zod 校验（已安装）
- 图表用 recharts（已安装）
- 移动端适配（用 useIsMobile hook）

## WebSocket RPC 调用封装

所有 daoxu-auth 的 RPC 调用都走 WebSocket，不走 HTTP。需要在 `lib/auth.ts` 里封装：

```typescript
async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  // 1. 确保 WebSocket 已连接（复用 openClawClient）
  // 2. 发送 { type: "chat.send", message: "/rpc <method> <JSON.stringify(params)>" }
  //    到 session agent:main:auth-rpc
  // 3. 监听响应，解析 JSON
  // 4. 返回结果
}
```

## 不要做的事

- 不要改 `lib/openclaw.ts` 的核心连接逻辑（握手协议不能变）
- 不要改首页已有的组件（Hero/Tools/Workflow/Features/ComingSoon/Wechat/Footer）
- 不要引入新的状态管理库（用 React Context + hooks）
- 不要加 HTTP API 路由（全部走 WebSocket RPC）
- 不要改 Express 后端（server/ 目录不动）

## 文件结构预期

```
client/src/
├── lib/
│   ├── openclaw.ts          （不动）
│   ├── visitor.ts           （改：登录后用 userId）
│   ├── auth.ts              （新：认证 SDK）
│   └── utils.ts             （不动）
├── contexts/
│   ├── ThemeContext.tsx      （不动）
│   └── AuthContext.tsx       （新：全局登录状态）
├── hooks/
│   ├── useChat.ts           （改：注入 user_context）
│   └── ...
├── pages/
│   ├── Home.tsx             （不动）
│   ├── Login.tsx            （新）
│   ├── Register.tsx         （新）
│   ├── Recover.tsx          （新）
│   ├── Profile.tsx          （新）
│   └── Admin.tsx            （新）
├── components/
│   ├── Navbar.tsx           （改：加登录状态）
│   ├── AgentChatPanel.tsx   （改：加多对话管理）
│   └── ...
└── App.tsx                  （改：加路由）
```
