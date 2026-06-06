import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { emailLoginAction, resendVerificationAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Shield } from "lucide-react";
import { getGoogleOAuthConfig } from "@/lib/settings";
import { AuthTurnstile } from "@/components/AuthTurnstile";

type Props = {
  searchParams: Promise<{
    error?: string;
    loginError?: string;
    registered?: string;
    email?: string;
    verifyError?: string;
    resendSent?: string;
    resendError?: string;
    retry?: string;
    accountDeleted?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  if (await isAuthenticated()) redirect("/admin");
  const {
    loginError,
    registered,
    email,
    verifyError,
    resendSent,
    resendError,
    retry,
    accountDeleted,
  } = await searchParams;
  const user = await getCurrentUser();
  const googleCfg = await getGoogleOAuthConfig();
  const googleEnabled = Boolean(googleCfg);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            后台登录
          </CardTitle>
          <CardDescription>多种方式登录管理面板</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Google OAuth */}
          {googleEnabled ? (
            <Button asChild variant="outline" className="w-full" size="lg">
              <a href="/api/auth/google">
                <GoogleIcon />
                使用 Google 登录
              </a>
            </Button>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Google 登录未启用（管理员可在 <a href="/admin/settings" className="underline">/admin/settings</a> 配置）
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">
                邮箱登录
              </span>
            </div>
          </div>

          <form action={emailLoginAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-password">密码</Label>
                <a
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  忘记密码？
                </a>
              </div>
              <Input
                id="email-password"
                name="password"
                type="password"
                placeholder="输入密码"
                required
              />
            </div>
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
            <AuthTurnstile action="login" />
            <Button type="submit" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              使用邮箱登录
            </Button>
          </form>

          {loginError === "unverified" && email && (
            <form action={resendVerificationAction} className="space-y-3">
              <input type="hidden" name="email" value={email} />
              <AuthTurnstile action="resend_verify" />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full"
              >
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

function GoogleIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
