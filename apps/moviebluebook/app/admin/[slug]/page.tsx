import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2, Send, Edit3, ExternalLink } from "lucide-react";
import { getAdminViewer } from "@/lib/admin-viewer";
import { getPostBySlugRaw } from "@/lib/posts";
import {
  approvePostAction,
  deletePostAction,
  returnToDraftAction,
  submitForReviewAction,
} from "@/lib/actions";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; review?: string }>;
};

export default async function PostPreviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error, review } = await searchParams;

  const { user, viewerEmail, admin } = await getAdminViewer();
  if (!user) redirect("/login");

  const post = await getPostBySlugRaw(slug);
  if (!post) notFound();
  // 权限：管理员或作者本人
  if (!admin && post.owner_email.toLowerCase() !== viewerEmail) {
    redirect("/admin?error=无权查看该文章");
  }

  // 只有已发布 + 管理员的才允许点开“前台”
  const canPreviewPublic =
    admin && post.status === "published" && post.owner_email === user.email;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {post.reviewed_at && (
            <span className="text-xs text-muted-foreground">
              审核时间 {post.reviewed_at}
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {review === "pending_review" && (
        <Alert>
          <AlertTitle>已提交审核</AlertTitle>
          <AlertDescription>已发送等待管理员审核。</AlertDescription>
        </Alert>
      )}
      {review === "published" && (
        <Alert>
          <AlertTitle>已发布</AlertTitle>
          <AlertDescription>这篇文章已经发布到前台。</AlertDescription>
        </Alert>
      )}

      {post.status === "rejected" && post.reject_reason && (
        <Alert variant="destructive">
          <AlertTitle>被拒绝原因</AlertTitle>
          <AlertDescription>
            {post.reject_reason}
            {post.reviewed_by && (
              <span className="mt-1 block text-xs opacity-80">
                审核人：{post.reviewed_by}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <article className="rounded-lg border bg-card p-6">
        {post.cover_image && (
          <div className="mb-6 aspect-[2/1] w-full overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
          <p className="mt-2 text-muted-foreground">{post.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={post.date}>{post.date}</time>
            <span>·</span>
            <span>{post.author}</span>
            <span>·</span>
            <span>作者：{post.owner_email}</span>
            {post.tags.length > 0 && (
              <>
                <span>·</span>
                <div className="flex flex-wrap gap-1">
                  {post.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>
        <Separator className="my-4" />
        <div className="prose prose-neutral max-w-none dark:prose-invert">
          {post.content.map((paragraph, i) => (
            <p key={i} className="mb-4 leading-7">
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        {admin && canPreviewPublic && (
          <Button asChild variant="outline" size="sm">
            <a href={`/blog/${post.slug}`} target="_blank">
              <ExternalLink className="mr-1 h-3 w-3" />
              前台预览
            </a>
          </Button>
        )}

        {(admin || post.owner_email.toLowerCase() === viewerEmail) &&
          (admin || post.status === "draft" || post.status === "rejected") && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/${post.slug}/edit`}>
                <Edit3 className="mr-1 h-3 w-3" />
                编辑
              </Link>
            </Button>
          )}

        {post.owner_email.toLowerCase() === viewerEmail &&
          (post.status === "draft" || post.status === "rejected") && (
            <form action={submitForReviewAction}>
              <input type="hidden" name="slug" value={post.slug} />
              <Button type="submit" size="sm">
                <Send className="mr-1 h-3 w-3" />
                提交审核
              </Button>
            </form>
          )}

        {admin && post.status === "pending_review" && (
          <>
            <form action={approvePostAction}>
              <input type="hidden" name="slug" value={post.slug} />
              <Button type="submit" size="sm">
                通过并发布
              </Button>
            </form>
            <Button asChild variant="destructive" size="sm">
              <Link href={`/admin/review/${post.slug}`}>拒绝</Link>
            </Button>
            <form action={returnToDraftAction}>
              <input type="hidden" name="slug" value={post.slug} />
              <Button type="submit" variant="outline" size="sm">
                退回草稿
              </Button>
            </form>
          </>
        )}

        <div className="ml-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  你即将永久删除 "{post.title}"，此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <form action={deletePostAction}>
                  <input type="hidden" name="slug" value={post.slug} />
                  <AlertDialogAction
                    type="submit"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    永久删除
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
