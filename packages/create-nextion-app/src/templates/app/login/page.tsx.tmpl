// Sign-in page. The `emailLoginAction` server action authenticates
// against the D1-backed user table exposed by `@notionx/core/auth`,
// rate-limits by email + IP, and sets the HMAC-signed user session
// cookie on success. The form is shadcn-styled and inherits the
// project's design tokens from `app/globals.css`.

import Link from "next/link";
import { redirect } from "next/navigation";
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
import { siteConfig } from "@/lib/site/config";
import {
  authenticateEmailUser,
  clearAuthRateLimits,
  enforceAuthRateLimits,
  isAuthenticated,
  recordAuthFailures,
  setUserSessionCookie,
  userToSession,
} from "@notionx/core/auth";
import { getClientIp } from "@notionx/core/util";

export const dynamic = "force-dynamic";

type LoginError = "invalid" | "unverified" | "rate" | "captcha";

function loginRedirect(error: LoginError, email?: string): never {
  const params = new URLSearchParams({ loginError: error });
  if (email) params.set("email", email);
  redirect(`/login?${params.toString()}`);
}

async function emailLoginAction(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) loginRedirect("invalid", email);

  const ip = await getClientIp();
  const limit = await enforceAuthRateLimits("login", { email, ip });
  if (!limit.ok) {
    const params = new URLSearchParams({
      loginError: "rate",
      retry: String(limit.retryAfterSec),
    });
    if (email) params.set("email", email);
    redirect(`/login?${params.toString()}`);
  }

  const result = await authenticateEmailUser({ email, password });
  if (!result.ok) {
    await recordAuthFailures("login", { email, ip });
    loginRedirect(result.reason, email);
  }

  await clearAuthRateLimits("login", { email, ip });
  await setUserSessionCookie(userToSession(result.user));
  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    loginError?: string;
    email?: string;
    retry?: string;
    registered?: string;
  }>;
}) {
  if (await isAuthenticated()) redirect("/admin");
  const sp = (await searchParams) ?? {};
  const emailValue = sp.email ?? "";
  const errorMessage = (() => {
    switch (sp.loginError) {
      case "invalid":
        return "邮箱或密码错误";
      case "unverified":
        return "邮箱还没有验证，请先打开验证邮件中的链接。";
      case "captcha":
        return "请完成人机验证后再试";
      case "rate":
        return `登录尝试过多，请 ${sp.retry ?? "900"} 秒后再试`;
      default:
        return null;
    }
  })();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Enter your admin credentials to manage {siteConfig.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sp.registered ? (
            <p className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              验证邮件已发送到 {emailValue || "你的邮箱"}，请先验证后再登录。
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <form action={emailLoginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                defaultValue={emailValue}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            没有账号？{" "}
            <Link href="/register" className="underline">
              立即注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
