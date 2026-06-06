import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPostBySlugRaw } from "@/lib/posts";
import { rejectPostAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function RejectPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isAdminEmail(user.email))) redirect("/admin?error=需要管理员权限");

  const post = await getPostBySlugRaw(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/review">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回审核列表
          </Link>
        </Button>
        <StatusBadge status={post.status} />
      </div>

      <h1 className="text-3xl font-bold tracking-tight">拒绝这篇文章</h1>
      <p className="text-sm text-muted-foreground">
        原因会附带在发给作者的通知中。请清晰、具体、便于修改。
      </p>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">{post.title}</h2>
        <code className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs">
          {post.slug}
        </code>
        <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {post.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          作者：{post.owner_email}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>提交失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Separator />

      <form action={rejectPostAction} className="space-y-3">
        <input type="hidden" name="slug" value={post.slug} />
        <label className="block text-sm font-medium" htmlFor="reason">
          拒绝原因
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={5}
          maxLength={2000}
          placeholder="例如：标题含有夸张用词；正文缺少论据支撑；标签需补充“入门指南”..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          提示：空原因会被退回，请填写。
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href="/admin/review">取消</Link>
          </Button>
          <Button type="submit" variant="destructive">
            确认拒绝
          </Button>
        </div>
      </form>
    </div>
  );
}
