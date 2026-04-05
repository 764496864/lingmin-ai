/**
 * visitor.ts — 跨智能体访客身份管理
 *
 * 所有 agent 共用同一个 visitor_id，存储在 localStorage 中。
 * 格式：v_<32位小写hex>，由 crypto.randomUUID() 去短横线生成。
 */

const STORAGE_KEY = "lingmin_visitor_id";

/**
 * 获取或创建 visitor_id。
 * 首次访问时生成并持久化到 localStorage，后续直接读取。
 */
export function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    // crypto.randomUUID() 返回 "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    // 去掉短横线得到 32 位小写 hex
    const raw = crypto.randomUUID().replaceAll("-", "").toLowerCase();
    id = `v_${raw}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * 构建 sessionKey。
 * 格式：agent:<agentId>:<channel>:<peerKind>:<peerId>
 */
export function buildSessionKey(
  agentId = "lingmin",
  channel = "webchat",
  peerKind = "direct",
): string {
  return `agent:${agentId}:${channel}:${peerKind}:${getOrCreateVisitorId()}`;
}
