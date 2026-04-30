# Reusable Modules — OpenClaw 用户系统模板

一套与品牌完全解耦的认证 + 个人中心 + 管理后台 React 模块，对接 OpenClaw Gateway 的 `daoxu-auth` plugin。新客户项目复制即用，**只需改 `.env.local`，不用改代码**。

---

## TL;DR

```bash
# 在新项目里
cp -r reusable-modules/* client/src/
# 编辑 client/.env.local（看下面 §配置）
# 安装依赖（看下面 §依赖）
# 装 shadcn 组件（看下面 §依赖）
pnpm dev
```

---

## 文件清单

```
reusable-modules/
├── README.md
├── config.ts                    ← 品牌名 / 存储前缀（env 注入）
├── lib/
│   ├── visitor.ts               ← 访客/用户 ID 管理 + sessionKey 构造
│   └── auth.ts                  ← 认证 SDK（WebSocket RPC → daoxu-auth）
├── contexts/
│   └── AuthContext.tsx          ← <AuthProvider> + useAuth() 全局登录态
├── hooks/
│   └── useChat.ts               ← 多智能体 + 多对话聊天 hook，含 [user_context] 注入
└── pages/
    ├── Login.tsx                ← 登录页（含共享 AuthPageLayout）
    ├── Register.tsx             ← 注册页（含共享 FormField）
    ├── Recover.tsx              ← 找回密码页
    ├── Profile.tsx              ← 个人中心（4 Tab：资料/记忆/统计/对话历史）
    └── Admin.tsx                ← 管理后台（用户列表 + 数据面板）
```

文件目录原样镜像 `client/src/`，复制过去后路径和 `@/` 别名自动对齐。

---

## 每个文件干什么

| 文件 | 作用 | 主要导出 |
|---|---|---|
| `config.ts` | 集中品牌/存储/后端配置，全部从 env 读 | `APP_NAME`、`APP_SUBTITLE`、`STORAGE_PREFIX`、`storageKey()` |
| `lib/visitor.ts` | 匿名 visitor_id 管理；登录后切换为 userId；统一 `buildSessionKey` 构造 | `getOrCreateVisitorId`、`setLoggedInUserId`、`getEffectivePeerId`、`buildSessionKey(agentId, conversationId?)` |
| `lib/auth.ts` | 通过 WS chat 流向 `agent:main:auth-rpc` 发 `/rpc <method> <json>` 调用 daoxu-auth；解析 final 事件返回 JSON | `register / login / logout / fetchCurrentUser / recoverPassword / updateProfile / setMemories / fetchStats / listChatSessions / fetchChatHistory / adminListUsers / adminGetUser / adminGetDashboard / isAdminUser` |
| `contexts/AuthContext.tsx` | 全局登录态 Provider，启动时用 sessionToken 自动恢复会话 | `<AuthProvider>`、`useAuth()` |
| `hooks/useChat.ts` | 单参聊天 hook：按 sessionKey 订阅事件流，已登录时 `sendMessage` 自动注入 `[user_context]` 块 | `useChat({ agentId, conversationId? })` |
| `pages/Login.tsx` | 登录页 + 共享 `AuthPageLayout` 壳 | `<Login>`、`AuthPageLayout` |
| `pages/Register.tsx` | 注册页 + 共享 `FormField`（被 Recover 复用）| `<Register>`、`FormField` |
| `pages/Recover.tsx` | 用安全问题找回密码 | `<Recover>` |
| `pages/Profile.tsx` | 个人中心，shadcn `Tabs` 4 个面板 | `<Profile header={...} />` |
| `pages/Admin.tsx` | 管理后台，含数据面板 + 用户表格 + 行展开详情 | `<Admin header={...} />` |

---

## 配置（`.env.local`）

只改这几行就够：

```bash
# === 品牌 ===
VITE_APP_NAME=新公司AI                    # 显示在 "登录{APP_NAME}" 等位置
VITE_APP_SUBTITLE=新公司                  # 页脚 "{APP_NAME} · {APP_SUBTITLE}"，可空
VITE_STORAGE_PREFIX=newco                 # localStorage key 前缀，避免多项目串数据

# === 后端 ===
VITE_OPENCLAW_WS_URL=ws://127.0.0.1:18889 # OpenClaw Gateway 地址
VITE_OPENCLAW_TOKEN=<gateway_token>        # gateway.auth.token

# === 管理员（可选）===
VITE_ADMIN_USER_IDS=user_abc,user_xyz     # 逗号分隔的管理员 userId 白名单
                                          # （也可以让服务端在 user.isAdmin 字段返回 true）
```

> **注意**：Vite 环境变量改完必须**重启 dev server**（不是 HMR），否则不生效。

---

## 依赖

### npm 包（`pnpm install`）

模块用到的运行时依赖：

```bash
pnpm add react react-dom wouter sonner recharts lucide-react
```

| 包 | 用途 |
|---|---|
| `wouter` | 路由（`Link` / `useLocation`）。如果项目用 `react-router`，需要把这两个导入换掉 |
| `sonner` | Toast 通知 |
| `recharts` | Profile + Admin 的柱状图 |
| `lucide-react` | 图标 |

**没有用** react-hook-form、zod、状态管理库。表单都是 `useState`。

### shadcn/ui 组件

模块内部 import 的 shadcn 组件（项目须提前装）：

```bash
pnpm dlx shadcn@latest add button input label textarea \
  spinner skeleton tabs accordion table tooltip sonner
```

| 组件 | 在哪里用 |
|---|---|
| `button` | 所有页面 |
| `input` | 所有表单 |
| `label` | 所有表单 |
| `textarea` | Profile（简介、记忆编辑）|
| `spinner` | 所有提交按钮加载态 |
| `skeleton` | Profile / Admin 加载态 |
| `tabs` | Profile 4 个 Tab |
| `accordion` | Profile 对话历史展开 |
| `table` | Admin 用户列表 |
| `sonner` | Toast（`<Toaster>` 在 `App.tsx` 挂一次） |
| `tooltip` | shadcn 默认要求顶层 `<TooltipProvider>` |

> 对应文件路径：`@/components/ui/button.tsx` 等。

### 项目须有的基础设施（**不在本模块**，需自备）

| 文件 | 说明 |
|---|---|
| `lib/openclaw.ts` | OpenClaw 私有协议 WebSocket 客户端，必须导出 `openClawClient` 单例。需暴露：`connect()`、`subscribe(sessionKey, handler)`、`sendChat(agentId, text, conversationId?)`、`sendChatToSession(sessionKey, text)`、`getHistory(agentId, limit?, conversationId?)`、`injectVisitorContext(agentId, conversationId?)`、`abort(agentId, conversationId?)`、`onStateChange(handler)`、`onError(handler)`、`getState()`，以及类型 `ChatMessage / ConnectionState / StreamEvent`。本仓库 `client/src/lib/openclaw.ts` 是参考实现，可直接复制。 |
| `@/` 路径别名 | 指向 `client/src/`，需在 `vite.config.ts` 和 `tsconfig.json` 配好（标准 shadcn 项目自带）。 |
| Tailwind CSS 4 + 设计系统 token | 模板用了 `oklch(...)` 色值和 `text-foreground / text-muted-foreground / bg-destructive` 等语义色，以及 `font-display`、`text-gradient-blue` 自定义样式类。可以直接复制 `client/src/index.css`。 |

---

## 接入步骤（5 分钟）

### 1. 复制文件

```bash
cp -r reusable-modules/config.ts          client/src/config.ts
cp -r reusable-modules/lib/*               client/src/lib/
cp -r reusable-modules/contexts/*          client/src/contexts/
cp -r reusable-modules/hooks/*             client/src/hooks/
cp -r reusable-modules/pages/*             client/src/pages/
```

### 2. 装依赖 + shadcn 组件

见上面的 §依赖。

### 3. 写 `.env.local`

见上面的 §配置。

### 4. 在 `App.tsx` 接 Provider 和路由

```tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Recover from "@/pages/Recover";
import Register from "@/pages/Register";
import { Route, Switch } from "wouter";

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/recover" component={Recover} />
          <Route path="/profile" component={Profile} />
          <Route path="/admin" component={Admin} />
        </Switch>
      </TooltipProvider>
    </AuthProvider>
  );
}
```

如要给 `/profile` 和 `/admin` 加自定义 Navbar：

```tsx
<Route path="/profile">
  <Profile header={<MyNavbar />} />
</Route>
```

### 5. 在你的 Navbar 里读登录态

```tsx
import { useAuth } from "@/contexts/AuthContext";

const { status, user, isAdmin, logout } = useAuth();

{status === "anonymous" && <Link href="/login">登录</Link>}
{status === "authenticated" && (
  <>
    <span>{user!.nickname || user!.username}</span>
    <Link href="/profile">个人中心</Link>
    {isAdmin && <Link href="/admin">管理后台</Link>}
    <button onClick={logout}>退出</button>
  </>
)}
```

### 6. 用 `useChat` 接聊天 UI

```tsx
import { useChat } from "@/hooks/useChat";

function MyChatPanel({ agentId }: { agentId: string }) {
  const { messages, sendMessage, isGenerating, initialize } = useChat({ agentId });

  useEffect(() => { initialize(); }, [initialize]);

  return ( /* 你的聊天 UI */ );
}
```

---

## 后端契约（daoxu-auth plugin RPC）

模块假设龙虾的 daoxu-auth plugin 提供以下 RPC method（通过 chat 流投递到 `agent:main:auth-rpc`）：

| method | 入参 | 返回 |
|---|---|---|
| `daoxu.user.register` | `{ username, password, securityQuestion, securityAnswer }` | `{ userId, username }` |
| `daoxu.user.login` | `{ username, password }` | `{ sessionToken, user: AuthUser }` |
| `daoxu.user.logout` | `{ sessionToken }` | — |
| `daoxu.user.me` | `{ sessionToken }` | `AuthUser` |
| `daoxu.user.recover` | `{ username, securityAnswer, newPassword }` | — |
| `daoxu.profile.update` | `{ sessionToken, nickname?, profile? }` | `AuthUser` |
| `daoxu.memory.set` | `{ sessionToken, memories: string[] }` | — |
| `daoxu.stats.me` | `{ sessionToken }` | `UserStats & { byAgent? }` |
| `daoxu.chat.sessions.list` | `{ sessionToken }` | `ChatSessionInfo[]` |
| `daoxu.chat.history_v2` | `{ sessionToken, sessionKey }` | `{ sessionKey, messages[] }` |
| `daoxu.admin.users.list` | `{ sessionToken, search? }` | `AdminUserSummary[]` |
| `daoxu.admin.user.get` | `{ sessionToken, userId }` | `AdminUserDetail` |
| `daoxu.admin.dashboard.metrics` | `{ sessionToken }` | `DashboardMetrics` |

返回值约定：`{ ok: true, data: ... }` 或 `{ ok: false, error: "..." }`，模块自动解开 `data`。

---

## 常见定制

### 改主题色

页面里硬编码了 `oklch(0.6 0.2 260)`（星河蓝）和 `oklch(0.82 0.1 85)`（金色）等。要换主题色，全局搜索这些值替换即可，或在 `index.css` 里把它们抽成 CSS 变量。

### 改 Token 价格

`pages/Profile.tsx` 和 `pages/Admin.tsx` 顶部各有：

```typescript
const RMB_PER_USD = 7.2;
const COST_PER_M_INPUT_USD = 3;
const COST_PER_M_OUTPUT_USD = 15;
```

按你用的模型调整。

### 改路由库（react-router 替换 wouter）

把所有 `import { Link, useLocation } from "wouter"` 换成 react-router 等价物。`useLocation()` 在 wouter 是 `[location, setLocation]` 元组，react-router 是对象，需要稍作改写。

### 关闭多对话

直接 `useChat({ agentId })` 不传 `conversationId` 就是默认对话单条会话。模块本身就支持单对话退化。

---

## 不包含的内容

下列文件不在本模块，需自备或参考主仓：

- `lib/openclaw.ts` — OpenClaw 协议客户端（参考 `client/src/lib/openclaw.ts`）
- `components/Navbar.tsx` — 顶部导航栏（每个项目品牌不同，自己写）
- `components/AgentChatPanel.tsx` — 浮窗聊天面板 UI（参考 `client/src/components/AgentChatPanel.tsx`）
- `components/ChatMessages.tsx` / `ChatInput.tsx` — 聊天 UI 子组件
- `pages/Home.tsx` — 首页（每个项目独立设计）
- `index.css` — Tailwind + 设计 token

如果整套带 UI 一起搬，把 `client/src/` 全拉一份做基础再改更省事。
