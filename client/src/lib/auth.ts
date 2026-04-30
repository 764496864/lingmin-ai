/**
 * auth.ts — 用户认证 SDK
 *
 * 通过 WebSocket RPC 调用龙虾的 daoxu-auth plugin，不走 HTTP API。
 *
 * RPC 调用方式：
 * 1. 向 sessionKey "agent:main:auth-rpc" 发 chat.send 消息
 * 2. 消息内容："/rpc <method> <jsonPayload>"
 * 3. 服务端通过 chat 事件返回 final 状态，message.content 是 JSON 字符串
 * 4. 解析 JSON 得到结果或错误
 *
 * sessionToken 持久化到 localStorage（key: "lingmin_session_token"）。
 */

import { openClawClient } from "./openclaw";

// ===========================================================================
// 类型
// ===========================================================================

/** 用户档案（profile 对象内的字段） */
export interface UserProfile {
  /** 职业 */
  role?: string;
  /** 简介 */
  bio?: string;
  /** 联系方式 */
  contact?: string;
}

/** 使用统计 */
export interface UserStats {
  conversationsTotal: number;
  tokensIn: number;
  tokensOut: number;
}

/** 当前用户对象 */
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
  /** 是否管理员 */
  isAdmin?: boolean;
}

/** 注册参数 */
export interface RegisterParams {
  username: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
}

/** 登录参数 */
export interface LoginParams {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResult {
  sessionToken: string;
  user: AuthUser;
}

/** 找回密码参数 */
export interface RecoverParams {
  username: string;
  securityAnswer: string;
  newPassword: string;
}

// ===========================================================================
// 常量
// ===========================================================================

/** auth-rpc 的固定 sessionKey（非标准 5 段格式） */
const AUTH_RPC_SESSION_KEY = "agent:main:auth-rpc";

/** sessionToken 在 localStorage 的 key */
const TOKEN_STORAGE_KEY = "lingmin_session_token";

/** RPC 调用超时（毫秒） */
const RPC_TIMEOUT_MS = 15_000;

// ===========================================================================
// sessionToken 管理
// ===========================================================================

/** 读取 sessionToken。未登录返回 null。 */
export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/** 写入 sessionToken（登录成功后调用）。 */
export function setSessionToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/** 清除 sessionToken（退出登录后调用）。 */
export function clearSessionToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// ===========================================================================
// RPC 核心：把 method+params 包装成 chat 消息，等响应解析 JSON
// ===========================================================================

/**
 * 调 daoxu-auth plugin 的 RPC 方法。
 * 通过 WebSocket chat 流送达 auth-rpc 智能体，等待 final 事件解析返回。
 */
async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  // 确保 WebSocket 已连接 + 握手完成
  await openClawClient.connect();

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    // 超时保护
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error("请求超时，请稍后再试"));
    }, RPC_TIMEOUT_MS);

    // 订阅 auth-rpc sessionKey 的事件
    const unsubscribe = openClawClient.subscribe(AUTH_RPC_SESSION_KEY, (event) => {
      if (settled) return;

      if (event.kind === "final") {
        settled = true;
        clearTimeout(timer);
        unsubscribe();

        // 解析 JSON 响应
        try {
          const text = (event.text || "").trim();
          if (!text) {
            reject(new Error("接待返回空响应"));
            return;
          }
          const parsed = JSON.parse(text);
          // 约定：{ ok: true, data: ... } 或 { ok: false, error: "..." }
          if (parsed && typeof parsed === "object") {
            if (parsed.ok === false || parsed.error) {
              reject(new Error(parsed.error || "请求失败"));
              return;
            }
            // 兼容两种返回形式：{ ok: true, data } 或直接返回 data
            resolve((parsed.data ?? parsed) as T);
            return;
          }
          resolve(parsed as T);
        } catch (e) {
          reject(new Error(`响应解析失败: ${(e as Error).message}`));
        }
      } else if (event.kind === "error") {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        reject(new Error(event.errorMessage || "请求出错"));
      } else if (event.kind === "aborted") {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        reject(new Error("请求被中断"));
      }
    });

    // 构造 RPC 消息：/rpc <method> <jsonPayload>
    const message = `/rpc ${method} ${JSON.stringify(params)}`;

    openClawClient
      .sendChatToSession(AUTH_RPC_SESSION_KEY, message)
      .catch((err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        reject(err);
      });
  });
}

// ===========================================================================
// 业务方法（薄封装）
// ===========================================================================

/** 注册新用户。 */
export function register(params: RegisterParams): Promise<{ userId: string; username: string }> {
  return rpc("daoxu.user.register", { ...params });
}

/** 登录。返回 sessionToken + 用户信息。 */
export function login(params: LoginParams): Promise<LoginResult> {
  return rpc("daoxu.user.login", { ...params });
}

/** 退出登录。 */
export function logout(sessionToken: string): Promise<void> {
  return rpc("daoxu.user.logout", { sessionToken });
}

/** 拉取当前用户信息（用于会话恢复）。 */
export function fetchCurrentUser(sessionToken: string): Promise<AuthUser> {
  return rpc("daoxu.user.me", { sessionToken });
}

/** 找回密码（用安全问题验证）。 */
export function recoverPassword(params: RecoverParams): Promise<void> {
  return rpc("daoxu.user.recover", { ...params });
}

/** 更新个人资料。 */
export function updateProfile(
  sessionToken: string,
  patch: { nickname?: string; profile?: UserProfile },
): Promise<AuthUser> {
  return rpc("daoxu.profile.update", { sessionToken, ...patch });
}

/** 设置用户记忆（覆盖式，传入完整数组）。 */
export function setMemories(sessionToken: string, memories: string[]): Promise<void> {
  return rpc("daoxu.memory.set", { sessionToken, memories });
}

/** 拉取使用统计。 */
export function fetchStats(sessionToken: string): Promise<UserStats & { byAgent?: Record<string, UserStats> }> {
  return rpc("daoxu.stats.me", { sessionToken });
}

/** 拉取对话列表（按 agent × 时间）。 */
export interface ChatSessionInfo {
  sessionKey: string;
  agentId: string;
  conversationId?: string;
  title?: string;
  lastMessageAt: string;
  messageCount: number;
}

export function listChatSessions(sessionToken: string): Promise<ChatSessionInfo[]> {
  return rpc("daoxu.chat.sessions.list", { sessionToken });
}

/** 拉取某条对话的完整历史。 */
export function fetchChatHistory(
  sessionToken: string,
  sessionKey: string,
): Promise<{ sessionKey: string; messages: Array<{ role: string; content: string; timestamp?: number }> }> {
  return rpc("daoxu.chat.history_v2", { sessionToken, sessionKey });
}

// ===========================================================================
// 管理员判断
// ===========================================================================

/**
 * 判断用户是否管理员。
 * 优先使用服务端返回的 user.isAdmin 字段；
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

/** 用户列表项（管理员视图） */
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

/** 用户详情（管理员视图） */
export interface AdminUserDetail extends AdminUserSummary {
  profile?: UserProfile;
  globalMemories?: string[];
  sessions?: ChatSessionInfo[];
}

/** 仪表盘指标 */
export interface DashboardMetrics {
  /** 今日活跃用户数 */
  activeUsersToday: number;
  /** 今日新注册用户数 */
  newUsersToday: number;
  /** 今日总对话轮次 */
  conversationsToday: number;
  /** 今日 input token */
  tokensInToday: number;
  /** 今日 output token */
  tokensOutToday: number;
  /** 按智能体分布的 token 用量 */
  byAgent: Array<{ agentId: string; tokensIn: number; tokensOut: number; conversations: number }>;
}

/** 列出全部用户（管理员）。 */
export function adminListUsers(
  sessionToken: string,
  query?: { search?: string },
): Promise<AdminUserSummary[]> {
  return rpc("daoxu.admin.users.list", { sessionToken, ...(query ?? {}) });
}

/** 拉取某个用户详情（管理员）。 */
export function adminGetUser(
  sessionToken: string,
  userId: string,
): Promise<AdminUserDetail> {
  return rpc("daoxu.admin.user.get", { sessionToken, userId });
}

/** 拉取仪表盘指标（管理员）。 */
export function adminGetDashboard(sessionToken: string): Promise<DashboardMetrics> {
  return rpc("daoxu.admin.dashboard.metrics", { sessionToken });
}
