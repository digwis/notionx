import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { changePasswordAction, deleteAccountAction } from "@/lib/actions";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyRound, Trash2, UserCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const user = await getUserById(session.uid);
  if (!user) redirect("/login");

  const { saved, error } = await searchParams;
  const hasPassword = Boolean(user.password_hash);
  const isAdmin = await isAdminEmail(user.email);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <UserCircle className="h-7 w-7" />
          账户设置
        </h1>
        <p className="text-sm text-muted-foreground">
          管理登录邮箱与密码
        </p>
      </div>

      {saved && (
        <Alert>
          <AlertTitle>密码已更新</AlertTitle>
          <AlertDescription>
            新密码已生效，其他设备上的旧会话已失效。
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
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">邮箱</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">登录方式</span>
            <span className="font-medium">
              {user.google_sub && user.password_hash
                ? "Google + 邮箱密码"
                : user.google_sub
                  ? "Google"
                  : "邮箱密码"}
            </span>
          </div>
        </CardContent>
      </Card>

      {hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              修改密码
            </CardTitle>
            <CardDescription>
              修改后当前及其他设备的登录会话将立即失效。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={changePasswordAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="至少 8 位，包含字母和数字"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                />
              </div>
              <Button type="submit">保存新密码</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>密码</CardTitle>
            <CardDescription>
              你使用 Google 登录，账户未设置密码。如需密码登录，请联系管理员或使用邮箱注册流程。
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              注销账户
            </CardTitle>
            <CardDescription>
              此操作不可恢复。你的文章将转移给管理员，账户数据将被永久删除。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={deleteAccountAction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">
                  输入邮箱 <span className="font-medium">{user.email}</span> 以确认
                </Label>
                <Input
                  id="confirmEmail"
                  name="confirmEmail"
                  type="email"
                  placeholder={user.email}
                  required
                />
              </div>
              {hasPassword && (
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">当前密码</Label>
                  <Input
                    id="deletePassword"
                    name="currentPassword"
                    type="password"
                    required
                  />
                </div>
              )}
              <Separator />
              <Button type="submit" variant="destructive">
                永久注销账户
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
