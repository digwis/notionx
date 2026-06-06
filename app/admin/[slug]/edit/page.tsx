import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { getPostBySlugRaw } from "@/lib/posts";
import { getAdminViewer } from "@/lib/admin-viewer";
import { perfSpan } from "@/lib/perf-trace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import EditPostFormLazy from "@/components/EditPostFormLazy";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

export default async function EditPostPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error, saved } = await searchParams;

  // 关键 D1 调用打 perfSpan，便于 Cloudflare Logs / Query Builder 还原每一步耗时
  const post = await perfSpan(
    { span: "posts.getPostBySlugRaw", pageClass: "admin_edit" },
    () => getPostBySlugRaw(slug)
  );
  if (!post) notFound();
  const { user, admin } = await perfSpan(
    { span: "admin.viewer", pageClass: "admin_edit" },
    () => getAdminViewer()
  );
  if (!user) redirect("/login");
  if (!admin && post.owner_email.toLowerCase() !== user.email.toLowerCase()) {
    redirect("/admin?error=无权编辑该文章");
  }
  if (!admin && !["draft", "rejected"].includes(post.status)) {
    redirect(`/admin/${slug}?error=当前状态不可编辑（${post.status}）`);
  }

  return (
    <div
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">编辑文章</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/${slug}`}>
              <ExternalLink className="mr-1 h-3 w-3" />
              返回预览
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Link>
          </Button>
        </div>
      </div>

      {saved && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>已保存</AlertTitle>
          <AlertDescription>所有改动已写入 D1。</AlertDescription>
        </Alert>
      )}

      <EditPostFormLazy
        slug={slug}
        initial={{
          title: post.title,
          description: post.description,
          date: post.date,
          author: post.author,
          tags: post.tags,
          content: post.content,
          cover_image: post.cover_image,
        }}
        error={error}
      />
    </div>
  );
}
