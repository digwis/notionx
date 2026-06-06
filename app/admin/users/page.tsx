import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listUsersWithPostCounts } from "@/lib/users";
import {
  adminDeleteUserAction,
  adminRevokeSessionsAction,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogOut, Trash2, Users } from "lucide-react";

type Props = {
  searchParams: Promise<{
    revoked?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  if (!(await isAdminEmail(session.email))) {
    redirect("/admin?error=需要管理员权限");
  }

  const { revoked, deleted, error } = await searchParams;
  const users = await listUsersWithPostCounts();

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
                const isSelf = u.email === session.email;
                const loginMethod =
                  u.google_sub && u.password_hash
                    ? "Google + 密码"
                    : u.google_sub
                      ? "Google"
                      : "邮箱密码";

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
                      {u.role === "admin" ? (
                        <Badge>管理员</Badge>
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
                        <form action={adminRevokeSessionsAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <Button type="submit" variant="outline" size="sm">
                            <LogOut className="mr-1 h-3 w-3" />
                            强制下线
                          </Button>
                        </form>
                        {!isSelf && u.role !== "admin" && (
                          <form action={adminDeleteUserAction}>
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
