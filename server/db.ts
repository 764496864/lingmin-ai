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
