import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminViewer } from "@/lib/admin-viewer";
import { perfSpan } from "@/lib/perf-trace";
import { logoutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Shield, Settings, UserCircle, Users } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // viewer 聚合了当前用户和管理员身份，避免 layout 里重复走认证链路。
  const { user, admin } = await perfSpan(
    { span: "admin.viewer", pageClass: "admin" },
    () => getAdminViewer()
  );
  if (!user) redirect("/login");

  return (
    <div
      className="min-h-screen bg-background"
    >
      <header className="border-b bg-muted/30">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold"
            >
              <Shield className="h-4 w-4" />
              vinext Admin
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              查看博客 →
            </Link>
            {admin && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                >
                  <Settings className="h-3.5 w-3.5" />
                  系统设置
                </Link>
                <Separator orientation="vertical" className="h-4" />
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                >
                  <Users className="h-3.5 w-3.5" />
                  用户管理
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs">
                {user.picture && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                )}
                <span className="hidden font-medium sm:inline">
                  {user.name || user.email}
                </span>
                {admin && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    管理员
                  </span>
                )}
              </div>
            )}
            {user && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/account">
                  <UserCircle className="mr-1 h-3 w-3" />
                  账户
                </Link>
              </Button>
            )}
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="mr-1 h-3 w-3" />
                登出
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="container mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
