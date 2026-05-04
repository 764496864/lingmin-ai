/**
 * server/db.ts — SQLite 数据访问层
 *
 * 表：
 *   users (user_id PK, username UNIQUE, password_hash, security_question,
 *          security_answer_hash, nickname, profile_json, memories_json,
 *          is_admin, created_at, last_login_at)
 *
 * JWT 是无状态的，不需要 sessions 表（logout 由客户端丢 token 实现）。
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ===========================================================================
// 初始化
// ===========================================================================

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./data/users.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    nickname TEXT,
    profile_json TEXT NOT NULL DEFAULT '{}',
    memories_json TEXT NOT NULL DEFAULT '[]',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id TEXT PRIMARY KEY,
    session_key TEXT NOT NULL UNIQUE,
    agent_id TEXT NOT NULL,
    user_id TEXT,
    visitor_id TEXT,
    conversation_id TEXT,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
    ON chat_sessions(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_updated
    ON chat_sessions(agent_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    user_id TEXT,
    visitor_id TEXT,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    run_id TEXT,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON chat_messages(session_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS chat_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    user_id TEXT,
    visitor_id TEXT,
    event TEXT NOT NULL,
    run_id TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_events_created
    ON chat_events(created_at DESC);
`);

console.log(`[db] users.db ready at ${DB_PATH}`);

// ===========================================================================
// 类型
// ===========================================================================

export interface UserProfile {
  role?: string;
  bio?: string;
  contact?: string;
}

/** SQLite 行原始结构（snake_case） */
export interface UserRow {
  user_id: string;
  username: string;
  password_hash: string;
  security_question: string;
  security_answer_hash: string;
  nickname: string | null;
  profile_json: string;
  memories_json: string;
  is_admin: number;
  created_at: string;
  last_login_at: string | null;
}

/** API 返回给前端的用户结构（驼峰、JSON 已解析） */
export interface AuthUserDto {
  userId: string;
  username: string;
  nickname?: string;
  profile?: UserProfile;
  globalMemories?: string[];
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatSessionRow {
  session_id: string;
  session_key: string;
  agent_id: string;
  user_id: string | null;
  visitor_id: string | null;
  conversation_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  tokens_in: number;
  tokens_out: number;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  session_key: string;
  agent_id: string;
  user_id: string | null;
  visitor_id: string | null;
  role: ChatRole;
  content: string;
  created_at: string;
  tokens_in: number;
  tokens_out: number;
  run_id: string | null;
}

export interface ChatSessionDto {
  sessionKey: string;
  agentId: string;
  conversationId?: string;
  title?: string;
  lastMessageAt: string;
  messageCount: number;
  tokensIn: number;
  tokensOut: number;
}

export interface ChatStatsDto {
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
  byAgent: Record<string, {
    conversationsTotal: number;
    tokensIn: number;
    tokensOut: number;
  }>;
}

/** 把 SQLite 行转成 API DTO */
export function rowToDto(row: UserRow): AuthUserDto {
  return {
    userId: row.user_id,
    username: row.username,
    nickname: row.nickname ?? undefined,
    profile: parseJson<UserProfile>(row.profile_json) ?? undefined,
    globalMemories: parseJson<string[]>(row.memories_json) ?? [],
    isAdmin: row.is_admin === 1,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? row.created_at,
  };
}

function parseJson<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ===========================================================================
// 预编译语句
// ===========================================================================

const stmtFindByUsername = db.prepare<[string], UserRow>(
  "SELECT * FROM users WHERE username = ?",
);
const stmtFindByUserId = db.prepare<[string], UserRow>(
  "SELECT * FROM users WHERE user_id = ?",
);
const stmtInsertUser = db.prepare(`
  INSERT INTO users (
    user_id, username, password_hash, security_question, security_answer_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`);
const stmtUpdateProfile = db.prepare(`
  UPDATE users SET nickname = ?, profile_json = ? WHERE user_id = ?
`);
const stmtUpdateMemories = db.prepare(`
  UPDATE users SET memories_json = ? WHERE user_id = ?
`);
const stmtUpdatePassword = db.prepare(`
  UPDATE users SET password_hash = ? WHERE user_id = ?
`);
const stmtUpdateLastLogin = db.prepare(`
  UPDATE users SET last_login_at = ? WHERE user_id = ?
`);
const stmtListAll = db.prepare<[], UserRow>(
  "SELECT * FROM users ORDER BY created_at DESC",
);
const stmtCountToday = db.prepare<[string], { c: number }>(
  "SELECT COUNT(*) AS c FROM users WHERE created_at >= ?",
);

const stmtFindChatSession = db.prepare<[string], ChatSessionRow>(
  "SELECT * FROM chat_sessions WHERE session_key = ?",
);
const stmtInsertChatSession = db.prepare(`
  INSERT INTO chat_sessions (
    session_id, session_key, agent_id, user_id, visitor_id, conversation_id,
    title, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtTouchChatSession = db.prepare(`
  UPDATE chat_sessions
  SET agent_id = ?,
      user_id = ?,
      visitor_id = ?,
      conversation_id = ?,
      updated_at = ?
  WHERE session_key = ?
`);
const stmtSetChatSessionTitle = db.prepare(`
  UPDATE chat_sessions
  SET title = COALESCE(title, ?),
      updated_at = ?
  WHERE session_id = ?
`);
const stmtInsertChatMessage = db.prepare(`
  INSERT INTO chat_messages (
    id, session_id, session_key, agent_id, user_id, visitor_id, role, content,
    created_at, tokens_in, tokens_out, run_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtAfterChatMessage = db.prepare(`
  UPDATE chat_sessions
  SET updated_at = ?,
      message_count = message_count + 1,
      tokens_in = tokens_in + ?,
      tokens_out = tokens_out + ?
  WHERE session_id = ?
`);
const stmtInsertChatEvent = db.prepare(`
  INSERT INTO chat_events (
    id, session_id, session_key, agent_id, user_id, visitor_id, event, run_id,
    tokens_in, tokens_out, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtListChatSessionsForUser = db.prepare<[string], ChatSessionRow>(
  "SELECT * FROM chat_sessions WHERE user_id = ? AND message_count > 0 ORDER BY updated_at DESC LIMIT 100",
);
const stmtGetChatSessionForUser = db.prepare<[string, string], ChatSessionRow>(
  "SELECT * FROM chat_sessions WHERE session_key = ? AND user_id = ?",
);
const stmtListChatMessages = db.prepare<[string, number], ChatMessageRow>(
  "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
);
const stmtChatStatsForUser = db.prepare<[string], {
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
}>(
  `
    SELECT
      COUNT(*) AS conversationsTotal,
      COALESCE(SUM(tokens_in), 0) AS tokensIn,
      COALESCE(SUM(tokens_out), 0) AS tokensOut
    FROM chat_sessions
    WHERE user_id = ? AND message_count > 0
  `,
);
const stmtChatStatsByAgentForUser = db.prepare<[string], {
  agent_id: string;
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
}>(
  `
    SELECT
      agent_id,
      COUNT(*) AS conversationsTotal,
      COALESCE(SUM(tokens_in), 0) AS tokensIn,
      COALESCE(SUM(tokens_out), 0) AS tokensOut
    FROM chat_sessions
    WHERE user_id = ? AND message_count > 0
    GROUP BY agent_id
  `,
);

// ===========================================================================
// 公共 API
// ===========================================================================

export function findByUsername(username: string): UserRow | undefined {
  return stmtFindByUsername.get(username);
}

export function findByUserId(userId: string): UserRow | undefined {
  return stmtFindByUserId.get(userId);
}

export interface CreateUserInput {
  userId: string;
  username: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
}

export function createUser(input: CreateUserInput): void {
  const now = new Date().toISOString();
  stmtInsertUser.run(
    input.userId,
    input.username,
    input.passwordHash,
    input.securityQuestion,
    input.securityAnswerHash,
    now,
  );
}

export function updateProfile(
  userId: string,
  patch: { nickname?: string; profile?: UserProfile },
): void {
  const row = findByUserId(userId);
  if (!row) throw new Error("user not found");
  const newNickname = patch.nickname !== undefined ? patch.nickname : row.nickname;
  const currentProfile = parseJson<UserProfile>(row.profile_json) ?? {};
  const newProfile = patch.profile !== undefined
    ? { ...currentProfile, ...patch.profile }
    : currentProfile;
  stmtUpdateProfile.run(newNickname, JSON.stringify(newProfile), userId);
}

export function updateMemories(userId: string, memories: string[]): void {
  stmtUpdateMemories.run(JSON.stringify(memories), userId);
}

export function updatePassword(userId: string, passwordHash: string): void {
  stmtUpdatePassword.run(passwordHash, userId);
}

export function updateLastLogin(userId: string): void {
  stmtUpdateLastLogin.run(new Date().toISOString(), userId);
}

export function listAllUsers(): UserRow[] {
  return stmtListAll.all();
}

/** 今日新注册用户数（按 created_at >= 今日 0 点） */
export function countNewUsersToday(): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = stmtCountToday.get(todayStart.toISOString());
  return result?.c ?? 0;
}

/** 今日活跃用户数（last_login_at 在今天） */
export function countActiveUsersToday(): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const stmt = db.prepare<[string], { c: number }>(
    "SELECT COUNT(*) AS c FROM users WHERE last_login_at >= ?",
  );
  const r = stmt.get(todayStart.toISOString());
  return r?.c ?? 0;
}

// ===========================================================================
// 聊天统计 / 历史
// ===========================================================================

export interface EnsureChatSessionInput {
  sessionKey: string;
  agentId: string;
  userId?: string | null;
  visitorId?: string | null;
  conversationId?: string | null;
  title?: string | null;
}

export function ensureChatSession(input: EnsureChatSessionInput): ChatSessionRow {
  const existing = stmtFindChatSession.get(input.sessionKey);
  const now = new Date().toISOString();
  if (existing) {
    stmtTouchChatSession.run(
      input.agentId,
      input.userId ?? null,
      input.visitorId ?? null,
      input.conversationId ?? null,
      now,
      input.sessionKey,
    );
    if (input.title) {
      stmtSetChatSessionTitle.run(input.title, now, existing.session_id);
    }
    return stmtFindChatSession.get(input.sessionKey)!;
  }

  const sessionId = `s_${randomUUID().replaceAll("-", "")}`;
  stmtInsertChatSession.run(
    sessionId,
    input.sessionKey,
    input.agentId,
    input.userId ?? null,
    input.visitorId ?? null,
    input.conversationId ?? null,
    input.title ?? null,
    now,
    now,
  );
  return stmtFindChatSession.get(input.sessionKey)!;
}

export interface RecordChatMessageInput extends EnsureChatSessionInput {
  role: ChatRole;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  runId?: string | null;
}

function titleFromUserMessage(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 40) return compact;
  return `${compact.slice(0, 40)}...`;
}

export function recordChatMessage(input: RecordChatMessageInput): ChatMessageRow {
  const session = ensureChatSession({
    sessionKey: input.sessionKey,
    agentId: input.agentId,
    userId: input.userId,
    visitorId: input.visitorId,
    conversationId: input.conversationId,
    title: input.role === "user" ? titleFromUserMessage(input.content) : input.title,
  });
  const now = new Date().toISOString();
  const id = `m_${randomUUID().replaceAll("-", "")}`;
  const tokensIn = input.tokensIn ?? 0;
  const tokensOut = input.tokensOut ?? 0;
  stmtInsertChatMessage.run(
    id,
    session.session_id,
    input.sessionKey,
    input.agentId,
    input.userId ?? null,
    input.visitorId ?? null,
    input.role,
    input.content,
    now,
    tokensIn,
    tokensOut,
    input.runId ?? null,
  );
  stmtAfterChatMessage.run(now, tokensIn, tokensOut, session.session_id);
  return {
    id,
    session_id: session.session_id,
    session_key: input.sessionKey,
    agent_id: input.agentId,
    user_id: input.userId ?? null,
    visitor_id: input.visitorId ?? null,
    role: input.role,
    content: input.content,
    created_at: now,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    run_id: input.runId ?? null,
  };
}

export interface RecordChatEventInput extends EnsureChatSessionInput {
  event: string;
  runId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
}

export function recordChatEvent(input: RecordChatEventInput): void {
  const session = ensureChatSession(input);
  stmtInsertChatEvent.run(
    `e_${randomUUID().replaceAll("-", "")}`,
    session.session_id,
    input.sessionKey,
    input.agentId,
    input.userId ?? null,
    input.visitorId ?? null,
    input.event,
    input.runId ?? null,
    input.tokensIn ?? 0,
    input.tokensOut ?? 0,
    new Date().toISOString(),
  );
}

function rowToChatSessionDto(row: ChatSessionRow): ChatSessionDto {
  return {
    sessionKey: row.session_key,
    agentId: row.agent_id,
    conversationId: row.conversation_id ?? undefined,
    title: row.title ?? undefined,
    lastMessageAt: row.updated_at,
    messageCount: row.message_count,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
  };
}

export function listChatSessionsForUser(userId: string): ChatSessionDto[] {
  return stmtListChatSessionsForUser.all(userId).map(rowToChatSessionDto);
}

export function listChatMessagesForUser(
  userId: string,
  sessionKey: string,
  limit = 200,
): ChatMessageRow[] {
  const session = stmtGetChatSessionForUser.get(sessionKey, userId);
  if (!session) return [];
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500));
  return stmtListChatMessages.all(session.session_id, safeLimit);
}

export function listChatMessagesForSession(
  sessionKey: string,
  limit = 200,
): ChatMessageRow[] {
  const session = stmtFindChatSession.get(sessionKey);
  if (!session) return [];
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500));
  return stmtListChatMessages.all(session.session_id, safeLimit);
}

export function getChatStatsForUser(userId: string): ChatStatsDto {
  const totals = stmtChatStatsForUser.get(userId) ?? {
    conversationsTotal: 0,
    tokensIn: 0,
    tokensOut: 0,
  };
  const byAgent: ChatStatsDto["byAgent"] = {};
  for (const row of stmtChatStatsByAgentForUser.all(userId)) {
    byAgent[row.agent_id] = {
      conversationsTotal: row.conversationsTotal,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
    };
  }
  return {
    conversationsTotal: totals.conversationsTotal,
    tokensIn: totals.tokensIn,
    tokensOut: totals.tokensOut,
    byAgent,
  };
}

export function getChatDashboardStatsToday(): {
  conversationsToday: number;
  tokensInToday: number;
  tokensOutToday: number;
  byAgent: Array<{ agentId: string; tokensIn: number; tokensOut: number; conversations: number }>;
} {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = todayStart.toISOString();
  const total = db.prepare<[string], {
    conversationsToday: number;
    tokensInToday: number;
    tokensOutToday: number;
  }>(`
    SELECT
      COUNT(*) AS conversationsToday,
      COALESCE(SUM(tokens_in), 0) AS tokensInToday,
      COALESCE(SUM(tokens_out), 0) AS tokensOutToday
    FROM chat_sessions
    WHERE updated_at >= ? AND message_count > 0
  `).get(since) ?? { conversationsToday: 0, tokensInToday: 0, tokensOutToday: 0 };

  const byAgent = db.prepare<[string], {
    agentId: string;
    tokensIn: number;
    tokensOut: number;
    conversations: number;
  }>(`
    SELECT
      agent_id AS agentId,
      COALESCE(SUM(tokens_in), 0) AS tokensIn,
      COALESCE(SUM(tokens_out), 0) AS tokensOut,
      COUNT(*) AS conversations
    FROM chat_sessions
    WHERE updated_at >= ? AND message_count > 0
    GROUP BY agent_id
    ORDER BY conversations DESC
  `).all(since);

  return {
    conversationsToday: total.conversationsToday,
    tokensInToday: total.tokensInToday,
    tokensOutToday: total.tokensOutToday,
    byAgent,
  };
}
