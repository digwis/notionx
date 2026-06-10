import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { forgotPasswordAction } from "@/lib/actions";
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
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthTurnstile } from "@/components/AuthTurnstile";

type Props = {
  searchParams: Promise<{
    sent?: string;
    email?: string;
    error?: string;
    retry?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  if (await isAuthenticated()) redirect("/admin");
  const { sent, email, error, retry } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            忘记密码
          </CardTitle>
          <CardDescription>
            输入注册邮箱，我们会发送重置链接（1 小时内有效）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <form action={forgotPasswordAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                defaultValue={email ?? ""}
                required
              />
            </div>
            <AuthTurnstile action="forgot_password" />
            <Button type="submit" className="w-full">
              发送重置链接
            </Button>
          </form>

          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
