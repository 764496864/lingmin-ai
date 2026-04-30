/**
 * config.ts — 项目品牌 / 存储 key / 后端地址 集中配置
 *
 * 全部从环境变量读取，避免硬编码。
 * 在 .env.local 里设：
 *   VITE_APP_NAME           品牌主名（"AI 助手"）
 *   VITE_APP_SUBTITLE       品牌副名（公司/平台名，可空）
 *   VITE_STORAGE_PREFIX     localStorage / sessionStorage 前缀（避免多项目串数据）
 *   VITE_OPENCLAW_WS_URL    OpenClaw Gateway WebSocket 地址
 *   VITE_OPENCLAW_TOKEN     Gateway token auth
 *   VITE_ADMIN_USER_IDS     管理员 userId 白名单（逗号分隔，可空）
 */

/** 品牌主名（用于登录/注册/找回密码页标题副本） */
export const APP_NAME: string =
  (import.meta.env.VITE_APP_NAME as string | undefined) ?? "AI 助手";

/** 品牌副名（用于页脚 "{APP_NAME} · {APP_SUBTITLE}"，可空字符串） */
export const APP_SUBTITLE: string =
  (import.meta.env.VITE_APP_SUBTITLE as string | undefined) ?? "";

/**
 * localStorage / sessionStorage key 前缀。
 * 多个产品共用同域时，必须设不同前缀避免数据串扰。
 */
export const STORAGE_PREFIX: string =
  (import.meta.env.VITE_STORAGE_PREFIX as string | undefined) ?? "app";

/** 派生：拼接前缀的 storage key 工具 */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}_${name}`;
}
