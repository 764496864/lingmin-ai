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
 *   GET  /api/user/stats           使用统计（来自龙虾 sessions.usage）
 *   GET  /api/user/sessions        对话列表（来自龙虾 sessions.list）
 *   GET  /api/user/sessions/:sessionKey/history    某条对话历史
 *
 *   GET  /api/admin/users          所有用户（管理员）
 *   GET  /api/admin/users/:userId  单个用户详情（管理员）
 *   GET  /api/admin/dashboard      数据面板（管理员）
 */

import { randomUUID } from "node:crypto";
import { Router } from "express";
import * as auth from "./auth";
import * as db from "./db";
import * as lobster from "./lobster-rpc";

const router = Router();

// ===========================================================================
// 工具：错误响应
// ===========================================================================

function badRequest(res: import("express").Response, msg: string): void {
  res.status(400).json({ error: msg });
}

// ===========================================================================
// 鉴权相关
// ===========================================================================

router.post("/register", async (req, res) => {
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

  db.createUser({
    userId,
    username: username.trim(),
    passwordHash,
    securityQuestion: securityQuestion.trim(),
    securityAnswerHash,
  });

  res.json({ userId, username: username.trim() });
});

router.post("/login", async (req, res) => {
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

  const row = db.findByUsername(username.trim());
  if (!row) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }
  const ok = await auth.verifyPassword(
    securityAnswer.trim().toLowerCase(),
    row.security_answer_hash,
  );
  if (!ok) {
    res.status(401).json({ error: "安全答案错误" });
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
  } catch (e) {
    res.status(502).json({
      error: `拉取使用统计失败：${e instanceof Error ? e.message : "unknown"}`,
    });
  }
});

router.get("/user/sessions", auth.requireAuth, async (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  try {
    const sessions = await lobster.fetchSessionsList(userId);
    res.json(sessions);
  } catch (e) {
    res.status(502).json({
      error: `拉取对话列表失败：${e instanceof Error ? e.message : "unknown"}`,
    });
  }
});

router.get("/user/sessions/:sessionKey/history", auth.requireAuth, async (req, res) => {
  const { userId } = req as auth.AuthedRequest;
  const sessionKey = req.params.sessionKey;
  // 安全检查：sessionKey 必须包含当前 userId（避免越权读其他人的对话）
  if (!sessionKey.includes(`:${userId}`)) {
    res.status(403).json({ error: "无权访问此对话" });
    return;
  }
  try {
    const messages = await lobster.fetchSessionHistory(sessionKey);
    res.json({ sessionKey, messages });
  } catch (e) {
    res.status(502).json({
      error: `拉取对话历史失败：${e instanceof Error ? e.message : "unknown"}`,
    });
  }
});

// ===========================================================================
// 管理员
// ===========================================================================

router.get("/admin/users", auth.requireAuth, auth.requireAdmin, async (_req, res) => {
  const rows = db.listAllUsers();

  // 并发拉每个用户的 usage（容错：失败的填 0）
  const summaries = await Promise.all(
    rows.map(async (row) => {
      let conversationsTotal = 0;
      let tokensIn = 0;
      let tokensOut = 0;
      try {
        const u = await lobster.fetchSessionsUsage(row.user_id);
        conversationsTotal = u.conversationsTotal ?? 0;
        tokensIn = u.tokensIn ?? 0;
        tokensOut = u.tokensOut ?? 0;
      } catch {
        // 静默：单用户拉取失败不阻塞列表
      }
      return {
        userId: row.user_id,
        username: row.username,
        nickname: row.nickname ?? undefined,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at ?? row.created_at,
        conversationsTotal,
        tokensIn,
        tokensOut,
      };
    }),
  );

  res.json(summaries);
});

router.get("/admin/users/:userId", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  const targetUserId = req.params.userId;
  const row = db.findByUserId(targetUserId);
  if (!row) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  const dto = db.rowToDto(row);
  let usage: lobster.LobsterUsage = { conversationsTotal: 0, tokensIn: 0, tokensOut: 0 };
  let sessions: lobster.LobsterSession[] = [];
  try { usage = await lobster.fetchSessionsUsage(targetUserId); } catch { /* ignore */ }
  try { sessions = await lobster.fetchSessionsList(targetUserId); } catch { /* ignore */ }

  res.json({
    ...dto,
    conversationsTotal: usage.conversationsTotal ?? 0,
    tokensIn: usage.tokensIn ?? 0,
    tokensOut: usage.tokensOut ?? 0,
    sessions,
  });
});

router.get("/admin/dashboard", auth.requireAuth, auth.requireAdmin, async (_req, res) => {
  const today = await lobster.fetchGlobalUsageToday();
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
