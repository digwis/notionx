// auth/auth-pages/register.tsx

import { redirect } from "next/navigation";
import type { AuthPageContext } from "./types";

export interface RegisterPageProps {
  ui: AuthPageContext["ui"];
  searchParams: { error?: string };
  registerAction: AuthPageContext["actions"] extends infer A
    ? A extends { register: infer F }
      ? F
      : never
    : never;
  isAuthenticated?: AuthPageContext["isAuthenticated"];
  redirectWhenAuthenticated?: string;
}

export default async function RegisterPage({
  ui,
  searchParams,
  registerAction,
  isAuthenticated,
  redirectWhenAuthenticated = "/admin",
}: RegisterPageProps) {
  if (isAuthenticated && (await isAuthenticated())) {
    redirect(redirectWhenAuthenticated);
  }
  const { error } = searchParams;
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
          <CardTitle>邮箱注册</CardTitle>
          <CardDescription>
            注册后会发送验证邮件，验证完成即可进入后台。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction as unknown as (formData: FormData) => void}>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoFocus
              required
            />
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="至少 8 位，包含字母和数字"
              required
            />
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              required
            />
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {Turnstile && <Turnstile action="register" />}
            <Button type="submit" className="w-full">注册并发送验证邮件</Button>
          </form>

          <Button asChild variant="ghost" className="w-full">
            <a href="/login">返回登录</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
