// auth/auth-pages/login.tsx
//
// Login page. Renders the "Sign in with Google" button when OAuth is
// configured plus the email/password form, with optional Turnstile
// captcha. All UI primitives are passed in via the `ui` prop so the
// package stays unopinionated about the design system.

import { redirect } from "next/navigation";
import type { AuthPageContext } from "./types";

export interface LoginPageProps {
  ui: AuthPageContext["ui"];
  searchParams: {
    error?: string;
    loginError?: string;
    registered?: string;
    email?: string;
    verifyError?: string;
    resendSent?: string;
    resendError?: string;
    retry?: string;
    accountDeleted?: string;
  };
  emailLoginAction: AuthPageContext["actions"] extends infer A
    ? A extends { emailLogin: infer F }
      ? F
      : never
    : never;
  resendVerificationAction?: AuthPageContext["actions"] extends infer A
    ? A extends { resendVerification: infer F }
      ? F
      : never
    : never;
  isAuthenticated?: AuthPageContext["isAuthenticated"];
  getCurrentUser?: AuthPageContext["getCurrentUser"];
  getGoogleOAuthConfig?: AuthPageContext["getGoogleOAuthConfig"];
  redirectWhenAuthenticated?: string;
}

export default async function LoginPage({
  ui,
  searchParams,
  emailLoginAction,
  resendVerificationAction,
  isAuthenticated,
  getCurrentUser,
  getGoogleOAuthConfig,
  redirectWhenAuthenticated = "/admin",
}: LoginPageProps) {
  if (isAuthenticated && (await isAuthenticated())) {
    redirect(redirectWhenAuthenticated);
  }
  const {
    loginError,
    registered,
    email,
    verifyError,
    resendSent,
    resendError,
    retry,
    accountDeleted,
  } = searchParams;
  const user = getCurrentUser ? await getCurrentUser() : null;
  const googleCfg = getGoogleOAuthConfig ? await getGoogleOAuthConfig() : null;
  const googleEnabled = Boolean(googleCfg);
  const { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, Separator, Turnstile } = ui;

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
          <CardTitle>后台登录</CardTitle>
          <CardDescription>多种方式登录管理面板</CardDescription>
        </CardHeader>
        <CardContent>
          {accountDeleted && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              账户已注销。如需再次使用，请重新注册。
            </div>
          )}
          {registered && (
            <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              验证邮件已发送到 {email ?? "你的邮箱"}，请先验证后再登录。
            </div>
          )}
          {verifyError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              验证链接无效或已过期，请重新发送验证邮件。
            </div>
          )}
          {resendSent && (
            <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              如果 {email ?? "该邮箱"} 有待验证账户，验证邮件已重新发送。
            </div>
          )}
          {resendError === "verified" && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              该邮箱已验证，请直接登录。
            </div>
          )}
          {resendError === "captcha" && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              请完成人机验证后再重发邮件
            </div>
          )}
          {resendError === "rate" && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              重发过于频繁，请 {retry ?? "900"} 秒后再试
            </div>
          )}

          {googleEnabled ? (
            <Button asChild variant="outline" className="w-full" size="lg">
              <a href="/api/auth/google">使用 Google 登录</a>
            </Button>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Google 登录未启用（管理员可在 <a href="/admin/settings" className="underline">/admin/settings</a> 配置）
            </div>
          )}

          <Separator />

          <form action={emailLoginAction as unknown as (formData: FormData) => void}>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
            <Label htmlFor="email-password">密码</Label>
            <Input
              id="email-password"
              name="password"
              type="password"
              placeholder="输入密码"
              required
            />
            {loginError === "rate" && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                登录尝试过多，请 {retry ?? "900"} 秒后再试
              </div>
            )}
            {loginError === "captcha" && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                请完成人机验证后再试
              </div>
            )}
            {loginError === "invalid" && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                邮箱或密码错误
              </div>
            )}
            {loginError === "unverified" && (
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                邮箱还没有验证，请先打开验证邮件中的链接。
              </div>
            )}
            {Turnstile && <Turnstile action="login" />}
            <Button type="submit" className="w-full">使用邮箱登录</Button>
          </form>

          {loginError === "unverified" && email && resendVerificationAction && (
            <form action={resendVerificationAction as unknown as (formData: FormData) => void}>
              <input type="hidden" name="email" value={email} />
              {Turnstile && <Turnstile action="resend_verify" />}
              <Button type="submit" variant="outline" size="sm" className="w-full">
                重新发送验证邮件
              </Button>
            </form>
          )}

          <Button asChild variant="secondary" className="w-full">
            <a href="/register">新用户注册</a>
          </Button>

          {user && (
            <p className="text-center text-xs text-muted-foreground">
              当前已登录：{user.email}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
