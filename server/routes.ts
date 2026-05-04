/**
 * server/routes.ts — /api/* HTTP 端点
 *
 * 路由分组：
 *   POST /api/register             注册
 *   POST /api/login                登录 → { token, user }
 *   POST /api/logout               退出（JWT 无状态，client 丢 token 即可）
 *   POST /api/recover              用安全问题重置密码
 *
 *   GET  /api/user/me              当前用户
 *   PUT  /api/user/profile         改昵称/职业/简介/联系方式
 *   PUT  /api/user/memories        覆盖记忆数组
 *   GET  /api/user/stats           使用统计（来自 SQLite chat_sessions）
 *   GET  /api/user/sessions        对话列表（来自 SQLite chat_sessions）
 *   GET  /api/user/sessions/:sessionKey/history    某条对话历史
 *
 *   GET  /api/admin/users          所有用户（管理员）
 *   GET  /api/admin/users/:userId  单个用户详情（管理员）
 *   GET  /api/admin/dashboard      数据面板（管理员）
 */

import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as auth from "./auth";
import * as db from "./db";

const router = Router();

// ===========================================================================
// 鉴权类端点的限速：5 次/分钟/IP
// ===========================================================================

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求太频繁，请 1 分钟后再试" },
});

// ===========================================================================
// 工具：错误响应
// ===========================================================================

function badRequest(res: import("express").Response, msg: string): void {
  res.status(400).json({ error: msg });
}

// ===========================================================================
// 鉴权相关
// ===========================================================================

router.post("/register", authLimiter, async (req, res) => {
  const { username, password, securityQuestion, securityAnswer } = req.body ?? {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof securityQuestion !== "string" ||
    typeof securityAnswer !== "string"
  ) {
    badRequest(res, "缺少必填字段");
    return;
  }
  if (username.trim().length < 3) {
    badRequest(res, "用户名至少 3 个字符");
    return;
  }
  if (password.length < 6) {
    badRequest(res, "密码至少 6 位");
    return;
  }
  if (db.findByUsername(username.trim())) {
    res.status(409).json({ error: "用户名已被占用" });
    return;
  }

  const userId = `u_${randomUUID().replaceAll("-", "")}`;
  const passwordHash = await auth.hashPassword(password);
  const securityAnswerHash = await auth.hashPassword(
    securityAnswer.trim().toLowerCase(),
  );

  // 注意：findByUsername 后到 createUser 之间有异步窗口（bcrypt.hash），
  // 并发同名注册会撞 SQLite UNIQUE 约束。catch 后返回 409，不让异常上抛。
  try {
    db.createUser({
      userId,
      username: username.trim(),
      passwordHash,
      securityQuestion: securityQuestion.trim(),
      securityAnswerHash,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.message?.includes("UNIQUE")) {
      res.status(409).json({ error: "用户名已被占用" });
      return;
    }
    throw e;
  }

  res.json({ userId, username: username.trim() });
});

router.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    badRequest(res, "用户名和密码不能为空");
    return;
  }

  const row = db.findByUsername(username.trim());
  if (!row || !(await auth.verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: "用户名或密码错误" });
    return;
  }

  db.updateLastLogin(row.user_id);
  const token = auth.signToken(row.user_id);
  const user = db.rowToDto({ ...row, last_login_at: new Date().toISOString() });
  res.json({ sessionToken: token, user });
});

router.post("/logout", auth.requireAuth, (_req, res) => {
  // JWT 无状态，client 丢弃 token 即可。这里只返回 200。
  res.json({ ok: true });
});

router.post("/recover", authLimiter, async (req, res) => {
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

  // 不论用户是否存在 / 答案是否正确，都返回相同的 401 + 跑同样的 bcrypt 工作量
  // 防止用户名枚举 + timing oracle
  const GENERIC_ERROR = "用户名或安全答案错误";
  const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX";

  const row = db.findByUsername(username.trim());
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

// ===========================================================================
// 用户自助（需登录）
// ===========================================================================

router.get("/user/me", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  const row = db.findByUserId(userId);
  if (!row) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  res.json(db.rowToDto(row));
});

router.put("/user/profile", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  const { nickname, profile } = req.body ?? {};

  // 类型校验
  if (nickname !== undefined && typeof nickname !== "string") {
    badRequest(res, "nickname 必须是字符串");
    return;
  }
  if (profile !== undefined && (typeof profile !== "object" || profile === null)) {
    badRequest(res, "profile 必须是对象");
    return;
  }

  try {
    db.updateProfile(userId, { nickname, profile });
    const row = db.findByUserId(userId)!;
    res.json(db.rowToDto(row));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "保存失败" });
  }
});

router.put("/user/memories", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  const { memories } = req.body ?? {};
  if (!Array.isArray(memories) || !memories.every((m) => typeof m === "string")) {
    badRequest(res, "memories 必须是字符串数组");
    return;
  }
  if (memories.length > 50) {
    badRequest(res, "最多 50 条记忆");
    return;
  }
  if (memories.some((m) => m.length > 300)) {
    badRequest(res, "单条记忆最多 300 字");
    return;
  }
  db.updateMemories(userId, memories);
  res.json({ ok: true });
});

router.get("/user/stats", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  res.json(db.getChatStatsForUser(userId));
});

router.get("/user/sessions", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  res.json(db.listChatSessionsForUser(userId));
});

router.get("/user/sessions/:sessionKey/history", auth.requireAuth, (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  const sessionKey = req.params.sessionKey;
  // 安全检查：解析 sessionKey 严格匹配 userId 段
  // 格式：agent:<agentId>:<channel>:<peerKind>:<peerId>[:<conversationId>]
  // 只比较第 5 段（peerId），避免子串误匹配 / 越权
  const keyParts = sessionKey.split(":");
  if (keyParts.length < 5 || keyParts[4] !== userId) {
    res.status(403).json({ error: "无权访问此对话" });
    return;
  }
  const messages = db.listChatMessagesForUser(userId, sessionKey).map((msg) => ({
    role: msg.role,
    content: msg.content,
    timestamp: Date.parse(msg.created_at),
  }));
  res.json({ sessionKey, messages });
});

// ===========================================================================
// 管理员
// ===========================================================================

router.get("/admin/users", auth.requireAuth, auth.requireAdmin, (_req, res) => {
  const rows = db.listAllUsers();

  const summaries = rows.map((row) => {
    const usage = db.getChatStatsForUser(row.user_id);
    return {
      userId: row.user_id,
      username: row.username,
      nickname: row.nickname ?? undefined,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at ?? row.created_at,
      conversationsTotal: usage.conversationsTotal,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
    };
  });

  res.json(summaries);
});

router.get("/admin/users/:userId", auth.requireAuth, auth.requireAdmin, (req, res) => {
  const targetUserId = req.params.userId;
  const row = db.findByUserId(targetUserId);
  if (!row) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  const dto = db.rowToDto(row);
  const usage = db.getChatStatsForUser(targetUserId);
  const sessions = db.listChatSessionsForUser(targetUserId);

  res.json({
    ...dto,
    conversationsTotal: usage.conversationsTotal ?? 0,
    tokensIn: usage.tokensIn ?? 0,
    tokensOut: usage.tokensOut ?? 0,
    sessions,
  });
});

router.get("/admin/dashboard", auth.requireAuth, auth.requireAdmin, (_req, res) => {
  const today = db.getChatDashboardStatsToday();
  res.json({
    activeUsersToday: db.countActiveUsersToday(),
    newUsersToday: db.countNewUsersToday(),
    conversationsToday: today.conversationsToday,
    tokensInToday: today.tokensInToday,
    tokensOutToday: today.tokensOutToday,
    byAgent: today.byAgent,
  });
});

export default router;
