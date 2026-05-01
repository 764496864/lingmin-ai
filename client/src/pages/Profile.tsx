/**
 * Profile — 个人中心
 *
 * 4 个 Tab：
 * 1. 个人资料 — 昵称 / 职业 / 简介 / 联系方式（updateProfile）
 * 2. 我的记忆 — 最多 50 条，每条最多 300 字（setMemories）
 * 3. 使用统计 — 总对话/Token/费用 + 按 agent 分布（fetchStats）
 * 4. 对话历史 — 按 agent × 时间 Accordion 展开（listChatSessions + fetchChatHistory）
 *
 * 未登录访问会跳转 /login。
 */

import Navbar from "@/components/Navbar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  type ChatSessionInfo,
  type UserStats,
  fetchChatHistory,
  fetchStats,
  listChatSessions,
  setMemories as setMemoriesApi,
  updateProfile,
} from "@/lib/auth";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useLocation } from "wouter";

// ===========================================================================
// Token 费用折算（粗略 Sonnet 单价，按需调整）
// ===========================================================================
const RMB_PER_USD = 7.2;
const COST_PER_M_INPUT_USD = 3;   // $3 / 1M input tokens
const COST_PER_M_OUTPUT_USD = 15; // $15 / 1M output tokens

function calculateCost(tokensIn: number, tokensOut: number): number {
  const inputUsd = (tokensIn / 1_000_000) * COST_PER_M_INPUT_USD;
  const outputUsd = (tokensOut / 1_000_000) * COST_PER_M_OUTPUT_USD;
  return (inputUsd + outputUsd) * RMB_PER_USD;
}

// ===========================================================================
// Profile 主页
// ===========================================================================

export default function Profile() {
  const { status, user, sessionToken } = useAuth();
  const [, setLocation] = useLocation();

  // 未登录访问 → 跳登录
  useEffect(() => {
    if (status === "anonymous") {
      setLocation("/login");
    }
  }, [status, setLocation]);

  if (status === "loading" || !user || !sessionToken) {
    return (
      <div className="min-h-screen bg-[oklch(0.08_0.015_260)] text-foreground">
        <Navbar />
        <div className="container pt-32 pb-24">
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.015_260)] text-foreground">
      <Navbar />

      {/* 背景光晕 */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[oklch(0.5_0.2_260/0.05)] blur-[120px] pointer-events-none" />

      <div className="container relative pt-28 pb-20">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground">
            个人中心
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            管理你的资料、记忆与对话记录
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          {/* 移动端横向滚动避免 4 个 tab 挤压 */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
            <TabsList className="bg-[oklch(0.13_0.022_260)] border border-[oklch(0.22_0.03_260)] inline-flex w-auto sm:w-full">
              <TabsTrigger value="profile">个人资料</TabsTrigger>
              <TabsTrigger value="memory">我的记忆</TabsTrigger>
              <TabsTrigger value="stats">使用统计</TabsTrigger>
              <TabsTrigger value="history">对话历史</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="memory">
            <MemoryTab />
          </TabsContent>
          <TabsContent value="stats">
            <StatsTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ===========================================================================
// 共享样式：卡片
// ===========================================================================
function PanelCard({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl bg-[oklch(0.1_0.02_260/0.95)] backdrop-blur-xl border border-[oklch(0.22_0.03_260)] p-6 sm:p-8">
      {title && (
        <h2 className="font-display font-semibold text-lg text-foreground mb-1">
          {title}
        </h2>
      )}
      {description && (
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
      )}
      {children}
    </div>
  );
}

// ===========================================================================
// Tab 1 — 个人资料
// ===========================================================================
function ProfileTab() {
  const { user, sessionToken, setUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [role, setRole] = useState(user?.profile?.role ?? "");
  const [bio, setBio] = useState(user?.profile?.bio ?? "");
  const [contact, setContact] = useState(user?.profile?.contact ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!sessionToken || !user || saving) return;
    setSaving(true);
    try {
      const updated = await updateProfile(sessionToken, {
        nickname: nickname.trim() || undefined,
        profile: {
          role: role.trim() || undefined,
          bio: bio.trim() || undefined,
          contact: contact.trim() || undefined,
        },
      });
      setUser(updated);
      toast.success("资料已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard
      title="个人资料"
      description="基本资料会作为 [user_context] 上下文传给所有智能体，让对话更贴合你的身份"
    >
      <div className="grid gap-5 max-w-xl">
        <div className="space-y-2">
          <Label className="text-sm text-foreground/80">用户名</Label>
          <Input
            value={user?.username ?? ""}
            disabled
            className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground/70">用户名不可修改</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nickname" className="text-sm text-foreground/80">
            昵称
          </Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="想让 AI 怎么称呼你"
            className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role" className="text-sm text-foreground/80">
            职业
          </Label>
          <Input
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="例如：内容创作者 / 短视频博主"
            className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio" className="text-sm text-foreground/80">
            简介
          </Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="一句话介绍你自己"
            rows={3}
            className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact" className="text-sm text-foreground/80">
            联系方式
          </Label>
          <Input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="微信号 / 邮箱（可选）"
            className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-fit bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] hover:from-[oklch(0.65_0.2_260)] hover:to-[oklch(0.55_0.18_260)] text-white font-semibold"
        >
          {saving ? <><Spinner className="size-4" />保存中...</> : "保存"}
        </Button>
      </div>
    </PanelCard>
  );
}

// ===========================================================================
// Tab 2 — 我的记忆
// ===========================================================================
const MAX_MEMORIES = 50;
const MAX_MEMORY_LEN = 300;

function MemoryTab() {
  const { user, sessionToken, setUser } = useAuth();
  const [memories, setMemoriesState] = useState<string[]>(user?.globalMemories ?? []);
  const [draft, setDraft] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const t = draft.trim();
    if (!t) return;
    if (t.length > MAX_MEMORY_LEN) {
      toast.error(`单条记忆最多 ${MAX_MEMORY_LEN} 字`);
      return;
    }
    if (memories.length >= MAX_MEMORIES) {
      toast.error(`最多 ${MAX_MEMORIES} 条记忆`);
      return;
    }
    setMemoriesState([...memories, t]);
    setDraft("");
  };

  const handleDelete = (idx: number) => {
    setMemoriesState(memories.filter((_, i) => i !== idx));
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingText(memories[idx]);
  };

  const handleConfirmEdit = () => {
    if (editingIdx === null) return;
    const t = editingText.trim();
    if (!t) {
      handleDelete(editingIdx);
    } else if (t.length > MAX_MEMORY_LEN) {
      toast.error(`单条记忆最多 ${MAX_MEMORY_LEN} 字`);
      return;
    } else {
      const next = [...memories];
      next[editingIdx] = t;
      setMemoriesState(next);
    }
    setEditingIdx(null);
    setEditingText("");
  };

  const handleSave = async () => {
    if (!sessionToken || !user || saving) return;
    setSaving(true);
    try {
      await setMemoriesApi(sessionToken, memories);
      setUser({ ...user, globalMemories: memories });
      toast.success("记忆已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard
      title="我的记忆"
      description="这些记忆会帮助 AI 更好地了解你，所有智能体共享。最多 50 条，每条最多 300 字。"
    >
      {/* 新增 */}
      <div className="flex gap-2 mb-6">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="添加一条新的记忆..."
          maxLength={MAX_MEMORY_LEN}
          className="bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
        />
        <Button
          onClick={handleAdd}
          disabled={!draft.trim()}
          variant="outline"
          className="shrink-0 border-[oklch(0.25_0.04_260)]"
        >
          <Plus className="size-4" />
          添加
        </Button>
      </div>

      {/* 列表 */}
      <div className="space-y-2 mb-6">
        {memories.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-[oklch(0.22_0.03_260)] rounded-xl">
            还没有记忆。试试添加："我是一个短视频博主，主要做美食内容"
          </div>
        )}
        {memories.map((m, idx) => (
          <div
            key={idx}
            className="group flex items-start gap-3 p-3 rounded-lg bg-[oklch(0.13_0.022_260)] border border-[oklch(0.2_0.025_260)] hover:border-[oklch(0.28_0.04_260)] transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.2_260)] shrink-0 mt-2" />
            <div className="flex-1 min-w-0">
              {editingIdx === idx ? (
                <Textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={handleConfirmEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleConfirmEdit();
                    }
                  }}
                  autoFocus
                  rows={2}
                  maxLength={MAX_MEMORY_LEN}
                  className="bg-[oklch(0.1_0.02_260)] border-[oklch(0.3_0.04_260)] text-sm"
                />
              ) : (
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="block w-full text-left text-sm text-foreground/90 break-words"
                >
                  {m}
                </button>
              )}
            </div>
            <button
              onClick={() => handleDelete(idx)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 shrink-0"
              aria-label="删除"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          {memories.length} / {MAX_MEMORIES} 条
        </span>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] hover:from-[oklch(0.65_0.2_260)] hover:to-[oklch(0.55_0.18_260)] text-white font-semibold"
        >
          {saving ? <><Spinner className="size-4" />保存中...</> : "保存记忆"}
        </Button>
      </div>
    </PanelCard>
  );
}

// ===========================================================================
// Tab 3 — 使用统计
// ===========================================================================
function StatsTab() {
  const { sessionToken } = useAuth();
  const [stats, setStats] = useState<(UserStats & { byAgent?: Record<string, UserStats> }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    fetchStats(sessionToken)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setErr(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionToken]);

  const cost = stats ? calculateCost(stats.tokensIn ?? 0, stats.tokensOut ?? 0) : 0;

  // 按 agent 数据 → recharts 输入
  const chartData = useMemo(() => {
    if (!stats?.byAgent) return [];
    return Object.entries(stats.byAgent).map(([agentId, s]) => ({
      agentId,
      Input: s.tokensIn,
      Output: s.tokensOut,
      对话数: s.conversationsTotal,
    }));
  }, [stats]);

  if (loading) {
    return (
      <PanelCard title="使用统计">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </PanelCard>
    );
  }

  if (err) {
    return (
      <PanelCard title="使用统计">
        <div className="text-sm text-destructive">{err}</div>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="总对话轮次" value={(stats?.conversationsTotal ?? 0).toLocaleString()} />
        <StatCard label="Input Token" value={(stats?.tokensIn ?? 0).toLocaleString()} />
        <StatCard label="Output Token" value={(stats?.tokensOut ?? 0).toLocaleString()} />
        <StatCard label="折算费用" value={`¥${cost.toFixed(2)}`} accent />
      </div>

      {/* 按 agent 分布 */}
      <PanelCard
        title="按智能体使用分布"
        description={chartData.length === 0 ? "还没有数据" : undefined}
      >
        {chartData.length > 0 && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.03 260)" />
                <XAxis dataKey="agentId" stroke="oklch(0.6 0.02 260)" fontSize={12} />
                <YAxis stroke="oklch(0.6 0.02 260)" fontSize={12} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.13 0.022 260)",
                    border: "1px solid oklch(0.25 0.03 260)",
                    borderRadius: "8px",
                    color: "oklch(0.93 0.005 260)",
                  }}
                />
                <Bar dataKey="Input" fill="oklch(0.6 0.2 260)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Output" fill="oklch(0.75 0.18 255)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[oklch(0.1_0.02_260/0.95)] border border-[oklch(0.22_0.03_260)] p-5">
      <div className="text-xs text-muted-foreground tracking-wider mb-2">{label}</div>
      <div
        className={`font-display font-bold text-2xl ${
          accent ? "text-gradient-blue" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 4 — 对话历史
// ===========================================================================
function HistoryTab() {
  const { sessionToken } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    listChatSessions(sessionToken)
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
        setErr(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionToken]);

  // 按 agentId 分组
  const groupedByAgent = useMemo(() => {
    const map = new Map<string, ChatSessionInfo[]>();
    sessions.forEach((s) => {
      const arr = map.get(s.agentId) ?? [];
      arr.push(s);
      map.set(s.agentId, arr);
    });
    // 每组按 lastMessageAt 倒序
    map.forEach((arr) =>
      arr.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")),
    );
    return map;
  }, [sessions]);

  if (loading) {
    return (
      <PanelCard title="对话历史">
        <Skeleton className="h-32" />
      </PanelCard>
    );
  }

  if (err) {
    return (
      <PanelCard title="对话历史">
        <div className="text-sm text-destructive">{err}</div>
      </PanelCard>
    );
  }

  if (sessions.length === 0) {
    return (
      <PanelCard title="对话历史">
        <div className="text-sm text-muted-foreground text-center py-8">
          暂无对话记录
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard title="对话历史" description="按智能体分组，最新的对话排在最前">
      <div className="space-y-6">
        {Array.from(groupedByAgent.entries()).map(([agentId, list]) => (
          <div key={agentId}>
            <h3 className="font-semibold text-sm text-foreground/90 mb-3">
              <span className="text-[oklch(0.75_0.18_255)]">●</span> {agentId}
              <span className="text-xs text-muted-foreground ml-2">
                {list.length} 条对话
              </span>
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {list.map((s) => (
                <ChatHistoryRow key={s.sessionKey} session={s} />
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function ChatHistoryRow({ session }: { session: ChatSessionInfo }) {
  const { sessionToken } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: string; content: string; timestamp?: number }> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async (open: boolean) => {
    if (!open || messages !== null || !sessionToken) return;
    setLoading(true);
    try {
      const result = await fetchChatHistory(sessionToken, session.sessionKey);
      setMessages(result.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const title =
    session.title ||
    `对话 ${(session.conversationId ?? session.sessionKey).substring(0, 12)}`;

  return (
    <AccordionItem
      value={session.sessionKey}
      className="border-[oklch(0.22_0.03_260)]"
    >
      <AccordionTrigger
        onClick={() => handleOpen(true)}
        className="hover:no-underline"
      >
        <div className="flex items-center justify-between w-full pr-4">
          <span className="text-sm text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">
            {session.messageCount ?? 0} 条 ·{" "}
            {session.lastMessageAt
              ? new Date(session.lastMessageAt).toLocaleString("zh-CN")
              : ""}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {loading && <Skeleton className="h-20" />}
        {!loading && messages && messages.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">（空对话）</div>
        )}
        {!loading && messages && messages.length > 0 && (
          <div className="space-y-2 py-2 max-h-96 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "bg-[oklch(0.55_0.18_255)]/10 text-foreground"
                    : "bg-[oklch(0.13_0.022_260)] text-foreground/90"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {m.role}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {m.content.replace(
                    /\[user_context\][\s\S]*?\[\/user_context\]\s*/g,
                    "",
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
