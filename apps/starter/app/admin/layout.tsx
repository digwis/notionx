// apps/starter/app/admin/layout.tsx
//
// Layout for every page under `/admin/*`. The package's `AdminShell`
// owns the chrome (brand, sidebar, header). This file wires the
// starter's nav, viewer, and design-system header extras (blog link,
// theme toggle, logout) into the shell.

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@vinext/foundation/admin";
import { getAdminViewer } from "@/lib/admin-viewer";
import { perfSpan } from "@/lib/perf-trace";
import { logoutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { Database, LogOut, Settings, Shield, UserCircle, Users } from "lucide-react";
import { adminNav } from "@/lib/admin/nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, viewerEmail, admin } = await perfSpan(
    { span: "admin.viewer", pageClass: "admin" },
    () => getAdminViewer()
  );
  if (!viewerEmail) redirect("/login");

  const viewer = {
    email: viewerEmail,
    name: user?.name ?? null,
    picture: user?.picture ?? null,
    isAdmin: admin,
    role: admin ? "admin" : "user",
  };

  // Best-effort: get the current pathname from headers. Falls back to
  // "/admin" so the dashboard is marked active by default.
  const h = await headers();
  const pathname = h.get("x-pathname") ?? h.get("x-invoke-path") ?? "/admin";

  return (
    <AdminShell
      nav={adminNav}
      viewer={viewer}
      pathname={pathname}
      brandLabel="vinext Admin"
      brandHref="/admin"
      viewerRoles={admin ? ["admin", "user"] : ["user"]}
      headerLinks={
        <>
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
                href="/admin/content-models"
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
              >
                <Database className="h-3.5 w-3.5" />
                内容模型
              </Link>
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
        </>
      }
      headerActions={
        <>
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
        </>
      }
    >
      {children}
    </AdminShell>
  );
}
