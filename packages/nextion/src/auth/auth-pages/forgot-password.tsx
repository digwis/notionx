// auth/auth-pages/forgot-password.tsx

import { redirect } from "next/navigation";
import type { AuthPageContext } from "./types";

export interface ForgotPasswordPageProps {
  ui: AuthPageContext["ui"];
  searchParams: {
    sent?: string;
    email?: string;
    error?: string;
    retry?: string;
  };
  forgotPasswordAction: AuthPageContext["actions"] extends infer A
    ? A extends { forgotPassword: infer F }
      ? F
      : never
    : never;
  isAuthenticated?: AuthPageContext["isAuthenticated"];
  redirectWhenAuthenticated?: string;
}

export default async function ForgotPasswordPage({
  ui,
  searchParams,
  forgotPasswordAction,
  isAuthenticated,
  redirectWhenAuthenticated = "/admin",
}: ForgotPasswordPageProps) {
  if (isAuthenticated && (await isAuthenticated())) {
    redirect(redirectWhenAuthenticated);
  }
  const { sent, email, error, retry } = searchParams;
  const { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, Turnstile } = ui;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "linear-gradient(to bottom right, var(--background), var(--muted))",
      }}
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>忘记密码</CardTitle>
          <CardDescription>
            输入注册邮箱，我们会发送重置链接（1 小时内有效）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent && (
            <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              如果 {email ?? "该邮箱"} 已注册且已验证，你会收到重置密码邮件。
            </div>
          )}
          {error === "invalid" && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              邮箱格式不正确
            </div>
          )}
          {error === "captcha" && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              请完成人机验证后再试
            </div>
          )}
          {error === "rate" && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              请求过于频繁，请 {retry ?? "900"} 秒后再试
            </div>
          )}

          <form action={forgotPasswordAction as unknown as (formData: FormData) => void}>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              defaultValue={email ?? ""}
              required
            />
            {Turnstile && <Turnstile action="forgot_password" />}
            <Button type="submit" className="w-full">发送重置链接</Button>
          </form>

          <Button asChild variant="ghost" className="w-full">
            <a href="/login">返回登录</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
