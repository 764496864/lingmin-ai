/**
 * Login — 登录页
 *
 * 暗色主题，星河蓝品牌色，居中卡片布局。
 * 品牌名通过 @/config 的 APP_NAME / APP_SUBTITLE 自动注入。
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { APP_NAME, APP_SUBTITLE } from "@/config";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError("用户名和密码不能为空");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      toast.success("登录成功");
      setLocation("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "登录失败";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout title="欢迎回来" subtitle={`登录 ${APP_NAME}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm text-foreground/80">
            用户名
          </Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="输入用户名"
            disabled={submitting}
            className="h-11 bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm text-foreground/80">
            密码
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
            disabled={submitting}
            className="h-11 bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-11 bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] hover:from-[oklch(0.65_0.2_260)] hover:to-[oklch(0.55_0.18_260)] text-white font-semibold"
        >
          {submitting ? (
            <>
              <Spinner className="size-4" />
              登录中...
            </>
          ) : (
            "登录"
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href="/register"
          className="hover:text-[oklch(0.75_0.18_255)] transition-colors"
        >
          没有账号？立即注册
        </Link>
        <Link
          href="/recover"
          className="hover:text-[oklch(0.75_0.18_255)] transition-colors"
        >
          忘记密码？
        </Link>
      </div>
    </AuthPageLayout>
  );
}

// ===========================================================================
// 共享认证页布局（Login/Register/Recover 都用这个壳）
// ===========================================================================

interface AuthPageLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthPageLayout({ title, subtitle, children }: AuthPageLayoutProps) {
  // 页脚品牌字：APP_NAME · APP_SUBTITLE（subtitle 为空则只显示 APP_NAME）
  const footerBrand = APP_SUBTITLE ? `${APP_NAME} · ${APP_SUBTITLE}` : APP_NAME;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "oklch(0.08 0.015 260)" }}
    >
      {/* 背景光晕 */}
      <div className="fixed top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[oklch(0.5_0.2_260/0.06)] blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[oklch(0.55_0.18_255/0.05)] blur-[100px] pointer-events-none" />

      {/* 返回首页 */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        <span>返回首页</span>
      </Link>

      <div className="relative w-full max-w-md">
        {/* 卡片 */}
        <div className="relative rounded-2xl bg-[oklch(0.1_0.02_260/0.95)] backdrop-blur-xl border border-[oklch(0.22_0.03_260)] p-8 sm:p-10 shadow-[0_0_60px_oklch(0.5_0.2_260/0.08)]">
          {/* 顶部 Logo + 标题 */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-12 h-12 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[oklch(0.6_0.2_260)] to-[oklch(0.75_0.18_255)] opacity-20" />
              <Sparkles className="w-6 h-6 text-[oklch(0.75_0.18_255)]" />
            </div>
            <h1 className="font-display font-bold text-2xl text-foreground mb-1">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>

        {/* 底部品牌字 */}
        <div className="text-center mt-6 text-xs text-muted-foreground/60 tracking-wider">
          {footerBrand}
        </div>
      </div>
    </div>
  );
}
