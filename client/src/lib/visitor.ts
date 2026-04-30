/**
 * visitor.ts — 访客 / 用户身份 + sessionKey 构造
 *
 * 匿名访客：localStorage 持久化的 v_<32hex>
 * 已登录用户：登录后由 AuthContext 调用 setLoggedInUserId(userId) 切换
 *
 * sessionKey 格式：
 * - 默认对话：agent:<agentId>:webchat:direct:<peerId>
 * - 命名对话：agent:<agentId>:webchat:direct:<peerId>:<conversationId>
 */

const STORAGE_KEY = "lingmin_visitor_id";

/** 当前已登录用户的 userId（null 表示未登录），AuthContext 在登录/登出时同步 */
let _loggedInUserId: string | null = null;

/**
 * 由 AuthContext 调用：登录成功传 userId，登出传 null。
 * 之后所有 buildSessionKey 调用都会用这个 userId 替代 visitorId。
 */
export function setLoggedInUserId(userId: string | null): void {
  _loggedInUserId = userId;
}

/** 获取或创建匿名 visitorId（仅未登录时使用）。 */
export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    const raw = crypto.randomUUID().replaceAll("-", "").toLowerCase();
    id = `v_${raw}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * 当前会话使用的 peer 标识。
 * 已登录 → userId；未登录 → visitorId。
 */
export function getEffectivePeerId(): string {
  return _loggedInUserId ?? getOrCreateVisitorId();
}

/**
 * 构建 sessionKey。
 *
 * @param agentId       智能体 ID（默认 lingmin）
 * @param conversationId 命名对话 ID（不传则用默认对话，sessionKey 末尾不带后缀）
 * @param channel       通道（webchat）
 * @param peerKind      对端类型（direct）
 */
export function buildSessionKey(
  agentId = "lingmin",
  conversationId?: string,
  channel = "webchat",
  peerKind = "direct",
): string {
  const peerId = getEffectivePeerId();
  const base = `agent:${agentId}:${channel}:${peerKind}:${peerId}`;
  return conversationId ? `${base}:${conversationId}` : base;
}
