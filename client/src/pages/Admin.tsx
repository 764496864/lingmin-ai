/**
 * Admin — 管理后台
 *
 * - 数据面板：今日活跃 / 新注册 / 对话量 / Token + 按 agent 分布柱状图
 * - 用户列表：表格（昵称/用户名/注册时间/最后登录/对话数/Token/费用）
 *   - 搜索过滤
 *   - 点击展开详情（资料/记忆/对话列表）
 *
 * 非管理员访问会跳回首页。
 */

import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AdminUserDetail,
  type AdminUserSummary,
  type DashboardMetrics,
  adminGetDashboard,
  adminGetUser,
  adminListUsers,
} from "@/lib/auth";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
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
import { useLocation } from "wouter";

// 复用 Profile 里的费用公式（不导出全局，简单复制）
const RMB_PER_USD = 7.2;
const COST_PER_M_INPUT_USD = 3;
const COST_PER_M_OUTPUT_USD = 15;
function calculateCost(tokensIn: number, tokensOut: number): number {
  return ((tokensIn / 1_000_000) * COST_PER_M_INPUT_USD +
    (tokensOut / 1_000_000) * COST_PER_M_OUTPUT_USD) * RMB_PER_USD;
}

// ===========================================================================
// Admin 主页
// ===========================================================================

export default function Admin() {
  const { status, isAdmin, sessionToken } = useAuth();
  const [, setLocation] = useLocation();

  // 非管理员重定向（包括未登录）
  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      setLocation("/login");
    } else if (!isAdmin) {
      setLocation("/");
    }
  }, [status, isAdmin, setLocation]);

  if (status === "loading" || !isAdmin || !sessionToken) {
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

      <div className="fixed top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[oklch(0.5_0.2_260/0.05)] blur-[120px] pointer-events-none" />

      <div className="container relative pt-28 pb-20 space-y-8">
        <div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground">
            管理后台
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            用户列表与数据面板
          </p>
        </div>

        <DashboardPanel sessionToken={sessionToken} />
        <UsersPanel sessionToken={sessionToken} />
      </div>
    </div>
  );
}

// ===========================================================================
// 数据面板
// ===========================================================================

function DashboardPanel({ sessionToken }: { sessionToken: string }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminGetDashboard(sessionToken)
      .then((m) => {
        if (cancelled) return;
        setMetrics(m);
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

  const chartData = useMemo(() => {
    if (!metrics?.byAgent) return [];
    return metrics.byAgent.map((a) => ({
      agentId: a.agentId,
      Input: a.tokensIn,
      Output: a.tokensOut,
      对话数: a.conversations,
    }));
  }, [metrics]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (err) {
    return (
      <PanelCard title="数据面板">
        <div className="text-sm text-destructive">{err}</div>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="今日活跃用户" value={(metrics?.activeUsersToday ?? 0).toLocaleString()} />
        <StatCard label="今日新注册" value={(metrics?.newUsersToday ?? 0).toLocaleString()} />
        <StatCard label="今日对话轮次" value={(metrics?.conversationsToday ?? 0).toLocaleString()} />
        <StatCard
          label="今日 Token (in/out)"
          value={`${(metrics?.tokensInToday ?? 0).toLocaleString()} / ${(metrics?.tokensOutToday ?? 0).toLocaleString()}`}
        />
        <StatCard
          label="今日费用"
          value={`¥${calculateCost(metrics?.tokensInToday ?? 0, metrics?.tokensOutToday ?? 0).toFixed(2)}`}
          accent
        />
      </div>

      <PanelCard
        title="按智能体分布"
        description={chartData.length === 0 ? "今天还没有数据" : undefined}
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

// ===========================================================================
// 用户列表
// ===========================================================================

function UsersPanel({ sessionToken }: { sessionToken: string }) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminListUsers(sessionToken)
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.nickname?.toLowerCase().includes(q) ?? false),
    );
  }, [users, search]);

  return (
    <PanelCard title="用户管理" description={`共 ${users.length} 位用户`}>
      {/* 搜索 */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索用户名或昵称..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
        />
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : err ? (
        <div className="text-sm text-destructive">{err}</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          {search ? "无匹配用户" : "暂无用户"}
        </div>
      ) : (
        <div className="rounded-xl border border-[oklch(0.22_0.03_260)] overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-[oklch(0.22_0.03_260)]">
                <TableHead className="w-8" />
                <TableHead>昵称 / 用户名</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead className="text-right">对话数</TableHead>
                <TableHead className="text-right">Token (in/out)</TableHead>
                <TableHead className="text-right">费用</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <UserRow
                  key={u.userId}
                  user={u}
                  expanded={expandedUserId === u.userId}
                  onToggle={() =>
                    setExpandedUserId(
                      expandedUserId === u.userId ? null : u.userId,
                    )
                  }
                  sessionToken={sessionToken}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PanelCard>
  );
}

function UserRow({
  user,
  expanded,
  onToggle,
  sessionToken,
}: {
  user: AdminUserSummary;
  expanded: boolean;
  onToggle: () => void;
  sessionToken: string;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 展开时拉详情
  useEffect(() => {
    if (!expanded || detail !== null) return;
    setLoadingDetail(true);
    adminGetUser(sessionToken, user.userId)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [expanded, detail, sessionToken, user.userId]);

  const cost = calculateCost(user.tokensIn ?? 0, user.tokensOut ?? 0);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-[oklch(0.13_0.022_260/0.6)] border-[oklch(0.22_0.03_260)]"
        onClick={onToggle}
      >
        <TableCell>
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="font-medium text-foreground">
            {user.nickname || user.username}
          </div>
          {user.nickname && (
            <div className="text-xs text-muted-foreground">@{user.username}</div>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "—"}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString("zh-CN")
            : "—"}
        </TableCell>
        <TableCell className="text-right text-sm">
          {(user.conversationsTotal ?? 0).toLocaleString()}
        </TableCell>
        <TableCell className="text-right text-sm">
          {(user.tokensIn ?? 0).toLocaleString()} /{" "}
          {(user.tokensOut ?? 0).toLocaleString()}
        </TableCell>
        <TableCell className="text-right text-sm font-medium text-[oklch(0.82_0.1_85)]">
          ¥{cost.toFixed(2)}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-[oklch(0.1_0.02_260)] border-[oklch(0.22_0.03_260)] hover:bg-[oklch(0.1_0.02_260)]">
          <TableCell colSpan={7} className="p-6">
            {loadingDetail && <Skeleton className="h-32" />}
            {!loadingDetail && detail && <UserDetailPanel detail={detail} />}
            {!loadingDetail && !detail && (
              <div className="text-sm text-destructive">加载详情失败</div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function UserDetailPanel({ detail }: { detail: AdminUserDetail }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* 个人资料 */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          个人资料
        </h4>
        <dl className="space-y-2 text-sm">
          <DetailRow label="userId" value={detail.userId} mono />
          <DetailRow label="昵称" value={detail.nickname || "—"} />
          <DetailRow label="职业" value={detail.profile?.role || "—"} />
          <DetailRow label="简介" value={detail.profile?.bio || "—"} />
          <DetailRow label="联系" value={detail.profile?.contact || "—"} />
        </dl>
      </div>

      {/* 记忆 */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          全局记忆 ({(detail.globalMemories ?? []).length})
        </h4>
        {(detail.globalMemories?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">无</div>
        ) : (
          <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-2">
            {detail.globalMemories!.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[oklch(0.65_0.2_260)]">•</span>
                <span className="text-foreground/90">{m}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 对话列表 */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          对话记录 ({(detail.sessions ?? []).length})
        </h4>
        {(detail.sessions?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">无</div>
        ) : (
          <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-2">
            {detail.sessions!.map((s) => (
              <li key={s.sessionKey} className="flex justify-between gap-2">
                <span className="text-foreground/90 truncate">
                  {s.title || s.agentId}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {s.messageCount ?? 0} 条
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-12 text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className={`flex-1 text-foreground/90 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

// ===========================================================================
// 共享小卡片
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

