/**
 * Recover — 找回密码页
 *
 * 表单：用户名 + 安全答案 + 新密码
 * 验证通过后重置密码，提示用户去登录
 */

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AuthPageLayout } from "./Login";
import { FormField } from "./Register";

export default function Recover() {
  const [, setLocation] = useLocation();
  const { recover } = useAuth();

  const [username, setUsername] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!username.trim()) return "请输入用户名";
    if (!securityAnswer.trim()) return "请输入安全答案";
    if (!newPassword) return "请输入新密码";
    if (newPassword.length < 6) return "新密码至少 6 位";
    if (newPassword !== confirmPassword) return "两次输入的密码不一致";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await recover({
        username: username.trim(),
        securityAnswer: securityAnswer.trim(),
        newPassword,
      });
      toast.success("密码重置成功，请用新密码登录");
      setLocation("/login");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "找回密码失败";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout title="找回密码" subtitle="用安全问题重置密码">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="username"
          label="用户名"
          type="text"
          autoComplete="username"
          value={username}
          onChange={setUsername}
          placeholder="注册时的用户名"
          disabled={submitting}
        />

        <FormField
          id="securityAnswer"
          label="安全答案"
          type="text"
          value={securityAnswer}
          onChange={setSecurityAnswer}
          placeholder="注册时填写的安全问题答案"
          disabled={submitting}
        />

        <FormField
          id="newPassword"
          label="新密码"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="6 位以上"
          disabled={submitting}
        />

        <FormField
          id="confirmPassword"
          label="确认新密码"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="再输入一次新密码"
          disabled={submitting}
        />

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
              重置中...
            </>
          ) : (
            "重置密码"
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href="/login"
          className="hover:text-[oklch(0.75_0.18_255)] transition-colors"
        >
          想起密码了？去登录
        </Link>
        <Link
          href="/register"
          className="hover:text-[oklch(0.75_0.18_255)] transition-colors"
        >
          注册新账号
        </Link>
      </div>
    </AuthPageLayout>
  );
}
