/**
 * server/auth.ts — 密码哈希 / JWT / 鉴权中间件
 */

import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { findByUserId } from "./db";

// ===========================================================================
// 配置
// ===========================================================================

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me-in-prod";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"] | undefined) ?? "7d";

if (JWT_SECRET === "dev-secret-change-me-in-prod") {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[auth] FATAL: JWT_SECRET must be set in production. Set JWT_SECRET in .env.local",
    );
  }
  console.warn(
    "[auth] WARNING: using default JWT_SECRET. Set JWT_SECRET in .env.local for production.",
  );
}

const BCRYPT_ROUNDS = 10;

// ===========================================================================
// 密码
// ===========================================================================

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ===========================================================================
// JWT
// ===========================================================================

interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): string {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  return decoded.userId;
}

// ===========================================================================
// Express 中间件
// ===========================================================================

/** 已通过 requireAuth 的请求会带上 userId 字段 */
export interface AuthedRequest extends Request {
  userId: string;
}

/** 提取 Bearer token，验证后把 userId 挂到 req 上。 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const token = header.substring(7);
  try {
    (req as AuthedRequest).userId = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}

/** 必须先经过 requireAuth；查 DB 确认 is_admin。 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as AuthedRequest).userId;
  if (!userId) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const row = findByUserId(userId);
  if (!row || row.is_admin !== 1) {
    res.status(403).json({ error: "无权访问" });
    return;
  }
  next();
}
