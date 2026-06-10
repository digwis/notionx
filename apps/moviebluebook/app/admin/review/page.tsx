import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, ArrowLeft, Eye } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPendingReviewPosts } from "@/lib/posts";
import {
  approvePostAction,
  returnToDraftAction,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Props = {
  searchParams: Promise<{
    approved?: string;
    rejected?: string;
    returned?: string;
    error?: string;
  }>;
};

export default async function ReviewListPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isAdminEmail(user.email))) {
    redirect("/admin?error=需要管理员权限");
  }

  const { approved, rejected, returned, error } = await searchParams;
  const pending = await getPendingReviewPosts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Inbox className="h-7 w-7" />
            内容审核
          </h1>
          <p className="text-sm text-muted-foreground">
            共 {pending.length} 篇文章等待审核
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回文章管理
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {approved && (
        <Alert>
          <AlertTitle>已通过</AlertTitle>
          <AlertDescription>“{approved}” 已发布到前台。</AlertDescription>
        </Alert>
      )}
      {rejected && (
        <Alert>
          <AlertTitle>已拒绝</AlertTitle>
          <AlertDescription>“{rejected}” 已退回作者，并附带原因。</AlertDescription>
        </Alert>
      )}
      {returned && (
        <Alert>
          <AlertTitle>已退回草稿</AlertTitle>
          <AlertDescription>“{returned}” 已退回为草稿。</AlertDescription>
        </Alert>
      )}

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          没有待审核的内容。
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => (
            <Card key={p.slug}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle>{p.title}</CardTitle>
                    <CardDescription>
                      作者：{p.owner_email} ·{" "}
                      <time dateTime={p.date}>{p.date}</time>
                    </CardDescription>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800">待审核</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/${p.slug}`}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      预览全文
                    </Link>
                  </Button>
                  <form action={approvePostAction}>
                    <input type="hidden" name="slug" value={p.slug} />
                    <Button type="submit" size="sm">
                      通过并发布
                    </Button>
                  </form>
                  <form action={returnToDraftAction}>
                    <input type="hidden" name="slug" value={p.slug} />
                    <Button type="submit" variant="outline" size="sm">
                      退回草稿
                    </Button>
                  </form>
                  <Button asChild variant="destructive" size="sm">
                    <Link href={`/admin/review/${p.slug}`}>拒绝并填原因</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
