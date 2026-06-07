import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminNotionPostCard from "@/components/AdminNotionPostCard";
import { getNotionEditBaseUrl } from "@/lib/notion/config";
import { getNotionPostBySlug } from "@/lib/notion/posts";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EditPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getNotionPostBySlug(slug);
  const notionHref = post?.editUrl ?? getNotionEditBaseUrl();

  return (
    <div
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">编辑文章</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Link>
          </Button>
        </div>
      </div>

      <AdminNotionPostCard
        title={post?.title ?? slug}
        description="正文、封面、标签和发布时间都在 Notion 中维护。"
        href={notionHref}
      />
    </div>
  );
}
