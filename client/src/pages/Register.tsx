/**
 * Register — 注册页
 *
 * 表单：用户名 + 密码 + 确认密码 + 安全问题 + 安全答案
 * 注册成功自动登录并跳转首页
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AuthPageLayout } from "./Login";

export default function Register() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!username.trim()) return "请输入用户名";
    if (username.trim().length < 3) return "用户名至少 3 个字符";
    if (!password) return "请输入密码";
    if (password.length < 6) return "密码至少 6 位";
    if (password !== confirmPassword) return "两次输入的密码不一致";
    if (!securityQuestion.trim()) return "请填写安全问题";
    if (!securityAnswer.trim()) return "请填写安全问题答案";
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
      await register({
        username: username.trim(),
        password,
        securityQuestion: securityQuestion.trim(),
        securityAnswer: securityAnswer.trim(),
      });
      toast.success("注册成功");
      setLocation("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "注册失败";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout title="创建账号" subtitle="加入灵敏 AI">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="username"
          label="用户名"
          type="text"
          autoComplete="username"
          value={username}
          onChange={setUsername}
          placeholder="3 个字符以上"
          disabled={submitting}
        />

        <FormField
          id="password"
          label="密码"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="6 位以上"
          disabled={submitting}
        />

        <FormField
          id="confirmPassword"
          label="确认密码"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="再输入一次密码"
          disabled={submitting}
        />

        <FormField
          id="securityQuestion"
          label="安全问题"
          type="text"
          value={securityQuestion}
          onChange={setSecurityQuestion}
          placeholder="例如：你最喜欢的城市？"
          disabled={submitting}
        />

        <FormField
          id="securityAnswer"
          label="安全答案"
          type="text"
          value={securityAnswer}
          onChange={setSecurityAnswer}
          placeholder="找回密码时需要回答"
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
              注册中...
            </>
          ) : (
            "注册并登录"
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        已有账号？{" "}
        <Link
          href="/login"
          className="text-[oklch(0.75_0.18_255)] hover:underline"
        >
          直接登录
        </Link>
      </div>
    </AuthPageLayout>
  );
}

// ===========================================================================
// 共享表单字段（紧凑、统一风格）
// ===========================================================================

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-foreground/80">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-11 bg-[oklch(0.13_0.022_260)] border-[oklch(0.22_0.03_260)] focus-visible:border-[oklch(0.55_0.18_255)]"
      />
    </div>
  );
}
