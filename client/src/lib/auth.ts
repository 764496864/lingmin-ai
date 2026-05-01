/**
 * auth.ts — 用户认证 SDK（HTTP API 版）
 *
 * 通过 fetch 调本项目 Express 服务（dev: vite proxy /api → :3000；prod: 同源）。
 * 不再走 WebSocket RPC（聊天功能仍走 WebSocket，互不影响）。
 *
 * sessionToken 持久化到 localStorage（key: "lingmin_session_token"）。
 */

// ===========================================================================
// 类型
// ===========================================================================

export interface UserProfile {
  /** 职业 */
  role?: string;
  /** 简介 */
  bio?: string;
  /** 联系方式 */
  contact?: string;
}

export interface UserStats {
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
}

export interface AuthUser {
  userId: string;
  username: string;
  nickname?: string;
  profile?: UserProfile;
  /** 用户全局记忆（最多 50 条，每条最多 300 字） */
  globalMemories?: string[];
  stats?: UserStats;
  createdAt: string;
  lastLoginAt: string;
  /** 是否管理员（服务端在 user.me 返回时填充） */
  isAdmin?: boolean;
}

export interface RegisterParams {
  username: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  sessionToken: string;
  user: AuthUser;
}

export interface RecoverParams {
  username: string;
  securityAnswer: string;
  newPassword: string;
}

// ===========================================================================
// 常量
// ===========================================================================

const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

const TOKEN_STORAGE_KEY = "lingmin_session_token";

// ===========================================================================
// sessionToken 管理
// ===========================================================================

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// ===========================================================================
// 通用 fetch 封装
// ===========================================================================

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function api<T>(
  method: Method,
  path: string,
  body?: Record<string, unknown> | null,
  explicitToken?: string,
): Promise<T> {
  const token = explicitToken ?? getSessionToken();
  const headers: Record<string, string> = {};
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`网络请求失败: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let errMsg = res.statusText || "请求失败";
    try {
      const data = await res.json();
      if (data && typeof data === "object" && typeof data.error === "string") {
        errMsg = data.error;
      }
    } catch {
      // 非 JSON 响应，沿用 statusText
    }
    throw new Error(errMsg);
  }

  // 204 / 空 body 兼容
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ===========================================================================
// 鉴权相关
// ===========================================================================

export function register(
  params: RegisterParams,
): Promise<{ userId: string; username: string }> {
  return api("POST", "/register", { ...params });
}

export function login(params: LoginParams): Promise<LoginResult> {
  return api("POST", "/login", { ...params });
}

export function logout(sessionToken: string): Promise<{ ok: true }> {
  return api("POST", "/logout", {}, sessionToken);
}

export function fetchCurrentUser(sessionToken: string): Promise<AuthUser> {
  return api("GET", "/user/me", null, sessionToken);
}

export function recoverPassword(params: RecoverParams): Promise<{ ok: true }> {
  return api("POST", "/recover", { ...params });
}

// ===========================================================================
// 用户自助
// ===========================================================================

export function updateProfile(
  sessionToken: string,
  patch: { nickname?: string; profile?: UserProfile },
): Promise<AuthUser> {
  return api("PUT", "/user/profile", patch, sessionToken);
}

export function setMemories(
  sessionToken: string,
  memories: string[],
): Promise<{ ok: true }> {
  return api("PUT", "/user/memories", { memories }, sessionToken);
}

export function fetchStats(
  sessionToken: string,
): Promise<UserStats & { byAgent?: Record<string, UserStats> }> {
  return api("GET", "/user/stats", null, sessionToken);
}

export interface ChatSessionInfo {
  sessionKey: string;
  agentId: string;
  conversationId?: string;
  title?: string;
  lastMessageAt: string;
  messageCount: number;
}

export async function listChatSessions(sessionToken: string): Promise<ChatSessionInfo[]> {
  // 服务端正常时返数组；龙虾挂了走降级路径返 { sessions: [], degraded: true }。
  // 这里统一规范成数组，避免下游 .filter 崩溃。
  const r = await api<unknown>("GET", "/user/sessions", null, sessionToken);
  if (Array.isArray(r)) return r as ChatSessionInfo[];
  if (r && typeof r === "object") {
    const inner = (r as { sessions?: unknown }).sessions;
    if (Array.isArray(inner)) return inner as ChatSessionInfo[];
  }
  return [];
}

export function fetchChatHistory(
  sessionToken: string,
  sessionKey: string,
): Promise<{
  sessionKey: string;
  messages: Array<{ role: string; content: string; timestamp?: number }>;
}> {
  // sessionKey 可能含 ":" 等字符，必须 URL 编码
  return api(
    "GET",
    `/user/sessions/${encodeURIComponent(sessionKey)}/history`,
    null,
    sessionToken,
  );
}

// ===========================================================================
// 管理员判断
// ===========================================================================

/**
 * 判断用户是否管理员。
 * 优先使用服务端返回的 user.isAdmin；
 * 否则查 VITE_ADMIN_USER_IDS 环境变量（逗号分隔的 userId 列表）。
 */
export function isAdminUser(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const raw = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined) ?? "";
  const adminIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(user.userId);
}

// ===========================================================================
// 管理后台 RPC
// ===========================================================================

export interface AdminUserSummary {
  userId: string;
  username: string;
  nickname?: string;
  createdAt: string;
  lastLoginAt: string;
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  profile?: UserProfile;
  globalMemories?: string[];
  sessions?: ChatSessionInfo[];
}

export interface DashboardMetrics {
  activeUsersToday: number;
  newUsersToday: number;
  conversationsToday: number;
  tokensInToday: number;
  tokensOutToday: number;
  byAgent: Array<{
    agentId: string;
    tokensIn: number;
    tokensOut: number;
    conversations: number;
  }>;
}

export function adminListUsers(
  sessionToken: string,
  query?: { search?: string },
): Promise<AdminUserSummary[]> {
  const qs = query?.search ? `?search=${encodeURIComponent(query.search)}` : "";
  return api("GET", `/admin/users${qs}`, null, sessionToken);
}

export function adminGetUser(
  sessionToken: string,
  userId: string,
): Promise<AdminUserDetail> {
  return api("GET", `/admin/users/${encodeURIComponent(userId)}`, null, sessionToken);
}

export function adminGetDashboard(
  sessionToken: string,
): Promise<DashboardMetrics> {
  return api("GET", "/admin/dashboard", null, sessionToken);
}
