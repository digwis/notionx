// admin/pages/settings.tsx
//
// Generic admin settings page. Lets an admin update the site title,
// Google OAuth config, and Turnstile config. Reads/writes the
// `app_settings` table and reads the worker env for the Turnstile
// secret. All data fetching and mutation is delegated to helpers
// passed in via `context.data` and `context.actions`.

import { redirect } from "next/navigation";
import { Bot, Save, Power, Settings2, ShieldCheck, Webhook } from "lucide-react";
import type { AdminPageContext } from "./types";

export interface AdminSettingsPageProps {
  context: AdminPageContext;
  searchParams: {
    saved?: string;
    error?: string;
  };
}

export default async function AdminSettingsPage({
  context,
  searchParams,
}: AdminSettingsPageProps) {
  const { ui, data, actions } = context;
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label, Alert, AlertTitle, AlertDescription, Separator, Badge } = ui;

  const user = (await data?.getCurrentUser?.()) ?? null;
  if (!user) redirect("/login");
  await data?.ensureAdminBootstrap?.();
  if (!(await data?.isAdminEmail?.(user.email))) {
    redirect("/admin?error=需要管理员权限");
  }

  const { saved, error } = searchParams;
  const s = (await data?.getAppSettings?.()) ?? {
    admin_email: user.email,
    site_title: "",
    google_enabled: 0 as const,
    google_client_id: null,
    google_client_secret: null,
    turnstile_enabled: 0 as const,
    turnstile_site_key: null,
  };
  const turnstile = (await data?.getTurnstilePublicConfig?.()) ?? {
    enabled: false,
    secretConfigured: false,
  };
  const siteHost = (() => {
    try {
      return new URL(data?.getSiteUrl?.() ?? "").hostname;
    } catch {
      return "your-domain.com";
    }
  })();
  const callbackUrl = `<your-domain>/api/auth/google/callback`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Settings2 className="h-7 w-7" />
            系统设置
          </h1>
          <p className="text-sm text-muted-foreground">
            只有管理员 <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s.admin_email}</code> 可以访问
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          管理员
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>保存失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {saved === "google" && (
        <Alert>
          <AlertTitle>已保存</AlertTitle>
          <AlertDescription>Google 登录配置已更新。</AlertDescription>
        </Alert>
      )}
      {saved === "disabled" && (
        <Alert>
          <AlertTitle>已关闭</AlertTitle>
          <AlertDescription>Google 登录已停用。</AlertDescription>
        </Alert>
      )}
      {saved === "title" && (
        <Alert>
          <AlertTitle>已保存</AlertTitle>
          <AlertDescription>站点名称已更新。</AlertDescription>
        </Alert>
      )}
      {saved === "turnstile" && (
        <Alert>
          <AlertTitle>已保存</AlertTitle>
          <AlertDescription>Turnstile 人机验证已更新。</AlertDescription>
        </Alert>
      )}
      {saved === "turnstile_disabled" && (
        <Alert>
          <AlertTitle>已关闭</AlertTitle>
          <AlertDescription>Turnstile 人机验证已停用。</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>站点信息</CardTitle>
          <CardDescription>对所有用户可见的基础信息</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={actions?.saveSiteTitle} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="site_title">站点名称</Label>
              <Input
                id="site_title"
                name="site_title"
                defaultValue={s.site_title}
                maxLength={80}
                required
              />
            </div>
            <Button type="submit">
              <Save className="mr-1 h-4 w-4" />
              保存
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Google 登录</span>
            {s.google_enabled === 1 ? (
              <Badge>已启用</Badge>
            ) : (
              <Badge variant="secondary">未启用</Badge>
            )}
          </CardTitle>
          <CardDescription>
            在 Google Cloud Console 创建 OAuth Web 应用，将回调地址填为
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              {callbackUrl}
            </code>
            然后把 Client ID / Secret 填到下面。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={actions?.saveGoogleSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google_client_id">Client ID</Label>
              <Input
                id="google_client_id"
                name="google_client_id"
                defaultValue={s.google_client_id ?? ""}
                placeholder="xxxxx.apps.googleusercontent.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google_client_secret">Client Secret</Label>
              <Input
                id="google_client_secret"
                name="google_client_secret"
                type="password"
                placeholder={
                  s.google_client_secret ? "已配置，留空表示不修改" : "GOCSPX-..."
                }
                autoComplete="new-password"
              />
              {s.google_client_secret && (
                <p className="text-xs text-muted-foreground">
                  当前已保存一条 Secret；为安全起见，输入框不回显明文，留空不会改动。
                </p>
              )}
            </div>

            <Separator />

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="google_enabled"
                value="1"
                defaultChecked={s.google_enabled === 1}
                className="h-4 w-4 rounded border-input"
              />
              <span>启用 Google 登录（登录页会显示“使用 Google 登录”按钮）</span>
            </label>

            <div className="flex items-center gap-2">
              <Button type="submit">
                <Save className="mr-1 h-4 w-4" />
                保存 Google 配置
              </Button>
            </div>
          </form>

          {s.google_enabled === 1 && actions?.disableGoogleSettings && (
            <form action={actions.disableGoogleSettings}>
              <Button type="submit" variant="outline">
                <Power className="mr-1 h-4 w-4" />
                关闭 Google 登录
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Turnstile 人机验证
            </span>
            {turnstile.enabled ? (
              <Badge>已启用</Badge>
            ) : (
              <Badge variant="secondary">未启用</Badge>
            )}
          </CardTitle>
          <CardDescription>
            与 Workers 同属 Cloudflare 账户，但需在{" "}
            <a
              href="https://dash.cloudflare.com/?to=/:account/turnstile"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Turnstile 控制台
            </a>{" "}
            单独创建 Widget。域名请包含 <code className="rounded bg-muted px-1 text-xs">localhost</code>、
            <code className="rounded bg-muted px-1 text-xs">127.0.0.1</code> 与{" "}
            <code className="rounded bg-muted px-1 text-xs">{siteHost}</code>。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={actions?.saveTurnstileSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="turnstile_site_key">Site Key（公开）</Label>
              <Input
                id="turnstile_site_key"
                name="turnstile_site_key"
                defaultValue={s.turnstile_site_key ?? ""}
                placeholder="0x4AAAAAAA..."
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Secret Key 不要写入数据库。生产环境执行：
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5">
                wrangler secret put TURNSTILE_SECRET_KEY
              </code>
              ；本地在 <code className="rounded bg-muted px-1">.dev.vars</code> 添加同名变量。
              {turnstile.secretConfigured ? (
                <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                  （当前已检测到 Secret）
                </span>
              ) : (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  （当前未检测到 Secret，启用前需配置）
                </span>
              )}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="turnstile_enabled"
                value="1"
                defaultChecked={s.turnstile_enabled === 1}
                className="h-4 w-4 rounded border-input"
              />
              <span>启用 Turnstile（登录 / 注册 / 忘记密码 / 重发验证）</span>
            </label>
            <Button type="submit">
              <Save className="mr-1 h-4 w-4" />
              保存 Turnstile 配置
            </Button>
          </form>
          {s.turnstile_enabled === 1 && actions?.disableTurnstileSettings && (
            <form action={actions.disableTurnstileSettings}>
              <Button type="submit" variant="outline">
                <Power className="mr-1 h-4 w-4" />
                关闭 Turnstile
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Google OAuth 回调地址
          </CardTitle>
          <CardDescription>
            请在 Google Cloud Console 把下方地址作为 “Authorized redirect URI”
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded bg-muted px-3 py-2 text-xs">
            {callbackUrl}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
