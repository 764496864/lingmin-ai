# Code 指令：修复 8 个问题 + 2 个文件更新

> 把这段完整发给 Claude Code。

---

修以下 10 项，按顺序做，做完跟我确认。

## 背景（你需要知道的）

这个项目的架构：
- 前端 React（client/）通过 HTTP 调 Express 后端（server/）做用户管理
- 前端通过 WebSocket 直连 OpenClaw Gateway（一个 AI 对话引擎）做聊天
- Express 后端也通过 WebSocket 连 OpenClaw Gateway，用来拉使用统计和对话列表
- OpenClaw Gateway 是一个独立的服务，跑在另一台电脑上，你不需要改它

## 修复清单

### 1. server/auth.ts — JWT 默认密钥生产环境必须 fail-fast

把第 19-22 行的 warn 改成：

```typescript
if (JWT_SECRET === "dev-secret-change-me-in-prod") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] FATAL: JWT_SECRET must be set in production. Set JWT_SECRET in .env.local");
  }
  console.warn("[auth] WARNING: using default JWT_SECRET. Set JWT_SECRET in .env.local for production.");
}
```

### 2. client/src/lib/openclaw.ts — 多 panel 事件覆盖

第 130-131 行，`errorHandler` 和 `stateHandler` 是单值，多个组件同时监听时后挂载的会覆盖前面的。

改成 Set 模式：

把这两行：
```typescript
private errorHandler: ErrorHandler | null = null;
private stateHandler: StateHandler | null = null;
```

改成：
```typescript
private errorHandlers = new Set<ErrorHandler>();
private stateHandlers = new Set<StateHandler>();
```

把 `onError` 和 `onStateChange` 方法改成返回 unsubscribe 函数：
```typescript
onError(handler: ErrorHandler): () => void {
  this.errorHandlers.add(handler);
  return () => { this.errorHandlers.delete(handler); };
}

onStateChange(handler: StateHandler): () => void {
  this.stateHandlers.add(handler);
  return () => { this.stateHandlers.delete(handler); };
}
```

把所有 `this.errorHandler?.(...)` 调用改成：
```typescript
this.errorHandlers.forEach(h => h(...));
```

把所有 `this.stateHandler?.(...)` 调用改成：
```typescript
this.stateHandlers.forEach(h => h(...));
```

同时改 `setState` 方法里的调用。

然后改 `client/src/hooks/useChat.ts`，在 useEffect 里拿到 unsubscribe 返回值，在 cleanup 时调用：
```typescript
useEffect(() => {
  const unsubState = openClawClient.onStateChange((s) => setConnectionState(s));
  const unsubError = openClawClient.onError((e) => setError(e));
  const unsubStream = openClawClient.subscribe(sessionKey, (event: StreamEvent) => { ... });

  return () => {
    unsubState();
    unsubError();
    unsubStream();
  };
}, [sessionKey]);
```

### 3. server/routes.ts — 注册 race condition

第 61-78 行，`db.findByUsername` 之后有个异步 `bcrypt.hash` 的时间窗口。在 `db.createUser` 调用外面包 try/catch：

```typescript
try {
  db.createUser({
    userId,
    username: username.trim(),
    passwordHash,
    securityQuestion: securityQuestion.trim(),
    securityAnswerHash,
  });
} catch (e: any) {
  if (e.code === "SQLITE_CONSTRAINT_UNIQUE" || e.message?.includes("UNIQUE")) {
    res.status(409).json({ error: "用户名已被占用" });
    return;
  }
  throw e;
}
```

### 4. server/routes.ts — recover 信息泄漏

第 122-133 行，`/api/recover` 对不存在的用户返回 404 "用户不存在"，对错误的安全答案返回 401 "安全答案错误"。攻击者可以遍历用户名探测哪些已注册。

改成：不论用户是否存在、安全答案是否正确，都返回相同的 401：

```typescript
router.post("/recover", async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof securityAnswer !== "string" ||
    typeof newPassword !== "string"
  ) {
    badRequest(res, "缺少必填字段");
    return;
  }
  if (newPassword.length < 6) {
    badRequest(res, "新密码至少 6 位");
    return;
  }

  const GENERIC_ERROR = "用户名或安全答案错误";
  const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX";

  const row = db.findByUsername(username.trim());
  // 不论用户是否存在，都跑一次 bcrypt.compare（防 timing oracle）
  const ok = await auth.verifyPassword(
    securityAnswer.trim().toLowerCase(),
    row?.security_answer_hash ?? DUMMY_HASH,
  );
  if (!row || !ok) {
    res.status(401).json({ error: GENERIC_ERROR });
    return;
  }

  const newHash = await auth.hashPassword(newPassword);
  db.updatePassword(row.user_id, newHash);
  res.json({ ok: true });
});
```

### 5. server/routes.ts + 新依赖 — 登录/注册/找回加限速

安装 express-rate-limit：
```bash
pnpm add express-rate-limit
```

在 routes.ts 顶部加：
```typescript
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求太频繁，请 1 分钟后再试" },
});
```

然后在 register、login、recover 三个路由前面加 `authLimiter`：
```typescript
router.post("/register", authLimiter, async (req, res) => { ... });
router.post("/login", authLimiter, async (req, res) => { ... });
router.post("/recover", authLimiter, async (req, res) => { ... });
```

### 6. server/index.ts — 优雅关停

在 `startServer` 函数的 `server.listen` 之后加：

```typescript
function gracefulShutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });
  // 强制超时
  setTimeout(() => {
    console.error("[server] forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

### 7. server/routes.ts — 龙虾挂时统计接口降级

把 `/user/stats`（约第 198 行）的 catch 从返回 502 改成返回兜底数据：

```typescript
router.get("/user/stats", auth.requireAuth, async (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  try {
    const usage = await lobster.fetchSessionsUsage(userId);
    res.json({
      conversationsTotal: usage.conversationsTotal ?? 0,
      tokensIn: usage.tokensIn ?? 0,
      tokensOut: usage.tokensOut ?? 0,
      byAgent: usage.byAgent ?? {},
    });
  } catch {
    res.json({
      conversationsTotal: 0,
      tokensIn: 0,
      tokensOut: 0,
      byAgent: {},
      degraded: true,
    });
  }
});
```

同理改 `/user/sessions` 的 catch：
```typescript
} catch {
  res.json({ sessions: [], degraded: true });
}
```

同理改 `/admin/dashboard` 的 catch（如果 `lobster.fetchGlobalUsageToday()` 失败）：在调用外包 try/catch，catch 里用 zeros。

### 8. CLAUDE.md — 标注过时

在文件最顶部第一行加：
```
> ⚠️ STATUS: COMPLETED — 以下所有功能已于 2026-05-01 全部实现。本文件保留作为架构参考。auth 已从 WebSocket RPC 改为 HTTP API（server/ 目录）。
```

### 9. 创建 .env.example

在项目根目录创建 `.env.example`：
```bash
# === 前端（Vite 环境变量，VITE_ 前缀） ===
VITE_OPENCLAW_WS_URL=ws://127.0.0.1:18789
VITE_OPENCLAW_TOKEN=
VITE_ADMIN_USER_IDS=
VITE_APP_NAME=AI 助手
VITE_APP_SUBTITLE=
VITE_STORAGE_PREFIX=app

# === 后端（Express 服务器） ===
JWT_SECRET=          # 生产必填！用 openssl rand -hex 32 生成
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/users.db
PORT=3000
# 如果和前端不同，单独配：
# OPENCLAW_WS_URL=ws://龙虾IP:18789
# OPENCLAW_TOKEN=
```

### 10. server/routes.ts — sessionKey 越权检查加强

第 230 行，把 `sessionKey.includes(`:${userId}`)` 改成严格解析：

```typescript
// 安全检查：解析 sessionKey 严格匹配 userId 段
const keyParts = sessionKey.split(":");
if (keyParts.length < 5 || keyParts[4] !== userId) {
  res.status(403).json({ error: "无权访问此对话" });
  return;
}
```

---

做完后跑 `npx tsc --noEmit` 确认零错误，再跑 `pnpm build` 确认构建通过。把结果告诉我。
