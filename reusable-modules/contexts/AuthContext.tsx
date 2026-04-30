/**
 * AuthContext — 全局登录状态管理
 *
 * 提供：
 * - user: 当前用户对象（null 表示未登录）
 * - sessionToken: 会话令牌
 * - isAdmin: 是否管理员（user.isAdmin 或 env 白名单）
 * - login / logout / register / recover / refreshUser / setUser
 *
 * 启动时如果 localStorage 有 sessionToken，自动调 daoxu.user.me 恢复会话。
 * 登录态变化会同步到 visitor.ts，让后续 sessionKey 用 userId 替代 visitorId。
 */

import {
  type AuthUser,
  type LoginParams,
  type RegisterParams,
  type RecoverParams,
  clearSessionToken,
  fetchCurrentUser,
  getSessionToken,
  isAdminUser,
  login as loginApi,
  logout as logoutApi,
  recoverPassword as recoverApi,
  register as registerApi,
  setSessionToken,
} from "@/lib/auth";
import { setLoggedInUserId } from "@/lib/visitor";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ===========================================================================
// Context 类型
// ===========================================================================

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  sessionToken: string | null;
  /** 当前用户是否是管理员 */
  isAdmin: boolean;

  /** 登录，成功后填充 user + token，失败抛错。 */
  login: (params: LoginParams) => Promise<AuthUser>;
  /** 注册，成功后自动登录并返回 user。 */
  register: (params: RegisterParams) => Promise<AuthUser>;
  /** 退出登录。 */
  logout: () => Promise<void>;
  /** 用安全问题找回密码（不会自动登录，由调用方决定后续）。 */
  recover: (params: RecoverParams) => Promise<void>;
  /** 重新拉取用户信息（更新 profile/memories/stats 后调用）。 */
  refreshUser: () => Promise<void>;
  /** 直接覆写 user（profile/memory 编辑后用本地数据更新，避免重复请求）。 */
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ===========================================================================
// Provider
// ===========================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionTokenState] = useState<string | null>(
    getSessionToken(),
  );
  const [status, setStatus] = useState<AuthStatus>(
    getSessionToken() ? "loading" : "anonymous",
  );

  // 启动时如果有 token，尝试恢复会话
  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      setStatus("anonymous");
      setLoggedInUserId(null);
      return;
    }

    let cancelled = false;
    fetchCurrentUser(token)
      .then((u) => {
        if (cancelled) return;
        setUserState(u);
        setLoggedInUserId(u.userId);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        // token 失效，清掉
        clearSessionToken();
        setSessionTokenState(null);
        setUserState(null);
        setLoggedInUserId(null);
        setStatus("anonymous");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (params: LoginParams): Promise<AuthUser> => {
    const result = await loginApi(params);
    setSessionToken(result.sessionToken);
    setSessionTokenState(result.sessionToken);
    setUserState(result.user);
    setLoggedInUserId(result.user.userId);
    setStatus("authenticated");
    return result.user;
  }, []);

  const register = useCallback(async (params: RegisterParams): Promise<AuthUser> => {
    // 先注册，再登录（注册成功后自动登录）
    await registerApi(params);
    const result = await loginApi({
      username: params.username,
      password: params.password,
    });
    setSessionToken(result.sessionToken);
    setSessionTokenState(result.sessionToken);
    setUserState(result.user);
    setLoggedInUserId(result.user.userId);
    setStatus("authenticated");
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const token = getSessionToken();
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        // 即使服务端报错也清本地状态
      }
    }
    clearSessionToken();
    setSessionTokenState(null);
    setUserState(null);
    setLoggedInUserId(null);
    setStatus("anonymous");
  }, []);

  const recover = useCallback(async (params: RecoverParams) => {
    await recoverApi(params);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getSessionToken();
    if (!token) return;
    const u = await fetchCurrentUser(token);
    setUserState(u);
    setLoggedInUserId(u.userId);
  }, []);

  const isAdmin = isAdminUser(user);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionToken,
      isAdmin,
      login,
      register,
      logout,
      recover,
      refreshUser,
      setUser: setUserState,
    }),
    [status, user, sessionToken, isAdmin, login, register, logout, recover, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ===========================================================================
// Hook
// ===========================================================================

/** 在组件中读取当前登录状态。 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 <AuthProvider> 内部使用");
  }
  return ctx;
}
