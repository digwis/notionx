// auth/auth-pages/reset-password.tsx

import { redirect } from "next/navigation";
import type { AuthPageContext } from "./types";

export interface ResetPasswordPageProps {
  ui: AuthPageContext["ui"];
  searchParams: {
    token?: string;
    error?: string;
  };
  resetPasswordAction: AuthPageContext["actions"] extends infer A
    ? A extends { resetPassword: infer F }
      ? F
      : never
    : never;
  isAuthenticated?: AuthPageContext["isAuthenticated"];
  redirectWhenAuthenticated?: string;
}

export default async function ResetPasswordPage({
  ui,
  searchParams,
  resetPasswordAction,
  isAuthenticated,
  redirectWhenAuthenticated = "/admin",
}: ResetPasswordPageProps) {
  if (isAuthenticated && (await isAuthenticated())) {
    redirect(redirectWhenAuthenticated);
  }
  const { token, error } = searchParams;
  if (!token) {
    redirect("/forgot-password?error=missing");
  }
  const { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent } = ui;

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
          <CardTitle>设置新密码</CardTitle>
          <CardDescription>请输入新密码，提交后将自动登录。</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form action={resetPasswordAction as unknown as (formData: FormData) => void}>
            <input type="hidden" name="token" value={token} />
            <Label htmlFor="password">新密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="至少 8 位，包含字母和数字"
              required
            />
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="再次输入新密码"
              required
            />
            <Button type="submit" className="w-full">更新密码并登录</Button>
          </form>

          <Button asChild variant="ghost" className="w-full">
            <a href="/login">返回登录</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
