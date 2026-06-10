import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminNotionPostCard from "@/components/AdminNotionPostCard";
import { getNotionEditBaseUrl } from "@/lib/notion/config";

export default function NewPostPage() {
  const notionHref = getNotionEditBaseUrl();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">新建文章</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回
          </Link>
        </Button>
      </div>
      <AdminNotionPostCard
        title="在 Notion 中创建文章"
        description="博客内容已迁移到 Notion。请在 Notion 数据源中创建文章并设置发布状态。"
        href={notionHref}
      />
    </div>
  );
}
