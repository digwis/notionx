// admin/pages/users.tsx
//
// Generic admin user-management page. Lists all users with their
// roles, login methods, and post counts, and provides inline actions
// to revoke sessions, change roles, or delete the user. All
// server-side work is done by helpers passed in via
// `context.data` and `context.actions`.

import { redirect } from "next/navigation";
import { Crown, LogOut, Trash2, UserCheck, Users } from "lucide-react";
import type { AdminPageContext } from "./types";

export interface AdminUsersPageProps {
  context: AdminPageContext;
  searchParams: {
    revoked?: string;
    deleted?: string;
    roleUpdated?: string;
    error?: string;
  };
}

export default async function AdminUsersPage({
  context,
  searchParams,
}: AdminUsersPageProps) {
  const { ui, data, actions } = context;
  const { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Alert, AlertTitle, AlertDescription, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = ui;

  const viewer = (await data?.getAdminViewer?.()) ?? null;
  if (!viewer?.viewer) redirect("/login");
  if (!viewer.admin) {
    redirect("/admin?error=需要管理员权限");
  }

  const { revoked, deleted, roleUpdated, error } = searchParams;
  const users = (await data?.listUsersWithPostCounts?.()) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Users className="h-7 w-7" />
          用户管理
        </h1>
        <p className="text-sm text-muted-foreground">
          强制下线会使该用户所有设备上的会话立即失效；删除用户会将其文章归属转移给管理员。
        </p>
      </div>

      {revoked && (
        <Alert>
          <AlertTitle>已强制下线</AlertTitle>
          <AlertDescription>{revoked} 的所有会话已失效。</AlertDescription>
        </Alert>
      )}
      {deleted && (
        <Alert>
          <AlertTitle>用户已删除</AlertTitle>
          <AlertDescription>
            已删除 {deleted}，其文章已归属管理员。
          </AlertDescription>
        </Alert>
      )}
      {roleUpdated && (
        <Alert>
          <AlertTitle>角色已更新</AlertTitle>
          <AlertDescription>{roleUpdated} 的权限已更新。</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>注册用户</CardTitle>
          <CardDescription>共 {users.length} 个账户</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>登录方式</TableHead>
                <TableHead>文章数</TableHead>
                <TableHead>最近活跃</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.email === viewer.viewerEmail;
                const loginMethod =
                  u.google_sub && u.password_hash
                    ? "Google + 密码"
                    : u.google_sub
                      ? "Google"
                      : "邮箱密码";
                const role: "user" | "vip" | "admin" =
                  u.role === "admin" || u.role === "vip"
                    ? u.role
                    : "user";

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.email}
                      {isSelf && (
                        <Badge variant="secondary" className="ml-2">
                          当前
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {role === "admin" ? (
                        <Badge>管理员</Badge>
                      ) : role === "vip" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" />
                          VIP
                        </Badge>
                      ) : (
                        <Badge variant="outline">用户</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {loginMethod}
                    </TableCell>
                    <TableCell>{u.post_count}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.last_seen_at}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!isSelf && role !== "admin" && actions?.adminSetUserRole && (
                          <form action={actions.adminSetUserRole}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input
                              type="hidden"
                              name="role"
                              value={role === "vip" ? "user" : "vip"}
                            />
                            <Button type="submit" variant="outline" size="sm">
                              {role === "vip" ? (
                                <>
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  设为用户
                                </>
                              ) : (
                                <>
                                  <Crown className="mr-1 h-3 w-3" />
                                  设为 VIP
                                </>
                              )}
                            </Button>
                          </form>
                        )}
                        {actions?.adminRevokeSessions && (
                          <form action={actions.adminRevokeSessions}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button type="submit" variant="outline" size="sm">
                              <LogOut className="mr-1 h-3 w-3" />
                              强制下线
                            </Button>
                          </form>
                        )}
                        {!isSelf && role !== "admin" && actions?.adminDeleteUser && (
                          <form action={actions.adminDeleteUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button
                              type="submit"
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              删除
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
