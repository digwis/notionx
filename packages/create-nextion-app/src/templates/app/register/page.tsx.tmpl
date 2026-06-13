// Self-service registration page. Creates a new user in D1, issues
// an email-verify token, and bounces the user back to /login with a
// `?registered=1` banner. Email delivery and the actual verify link
// come from the package's `auth/email` and `/api/auth/verify-email`
// flows; this page just produces a registration row.

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
  createEmailUser,
  isAuthenticated,
  validatePasswordStrength,
} from "@notionx/core/auth";
import { getClientIp } from "@notionx/core/util";

export const dynamic = "force-dynamic";

type RegisterError = "exists" | "weak" | "missing";

function registerRedirect(error: RegisterError, email?: string): never {
  const params = new URLSearchParams({ error });
  if (email) params.set("email", email);
  redirect(`/register?${params.toString()}`);
}

async function registerAction(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) registerRedirect("missing", email);

  const strength = validatePasswordStrength(password);
  if (strength) registerRedirect("weak", email);

  const ip = await getClientIp();
  void ip; // Reserved for future rate limiting on the register flow.

  const result = await createEmailUser({ email, password });
  if (!result.ok) registerRedirect("exists", email);

  // Verification email delivery is intentionally out of scope for
  // the scaffold. The user can wire Resend via `lib/email/resend.ts`
  // or trigger `/api/auth/verify-email?token=…` manually from the
  // admin panel to confirm the account.
  const params = new URLSearchParams({ registered: "1" });
  params.set("email", email);
  redirect(`/login?${params.toString()}`);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  if (await isAuthenticated()) redirect("/admin");
  const sp = (await searchParams) ?? {};
  const emailValue = sp.email ?? "";
  const errorMessage = (() => {
    switch (sp.error) {
      case "exists":
        return "该邮箱已注册，直接登录即可。";
      case "weak":
        return "密码至少 8 位且需同时包含字母和数字。";
      case "missing":
        return "请填写邮箱和密码。";
      default:
        return null;
    }
  })();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Register an admin account for {siteConfig.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage ? (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <form action={registerAction} className="space-y-4">
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
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                至少 8 位，需同时包含字母和数字。
              </p>
            </div>
            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            已有账号？{" "}
            <Link href="/login" className="underline">
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
