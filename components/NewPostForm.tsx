"use client";

// NewPostForm - 新建文章 Client Component
// 与 EditPostForm 一样的模式：所有字段 useState，submit 时显式塞 FormData

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { createPostAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ImageUploader from "./ImageUploader";

type Props = {
  error?: string;
};

export default function NewPostForm({ error }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [author, setAuthor] = useState("zhao");
  const [tagsStr, setTagsStr] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("date", date);
    fd.set("author", author);
    fd.set("tags", tagsStr);
    fd.set("content", content);
    fd.set("coverImage", coverImage);

    startTransition(async () => {
      try {
        await createPostAction(fd);
        router.replace(`/admin?created=${slug}`);
        router.refresh();
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        console.error("[new submit error]", e);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>文章内容</CardTitle>
        <CardDescription>填好后点 "发布"，新文章会立刻出现在博客列表。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>无法发布</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="my-new-post"
              pattern="[a-z0-9][a-z0-9\-]*"
            />
            <p className="text-xs text-muted-foreground">
              URL 路径：/blog/&lt;slug&gt;，只能含小写字母数字和短横线
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">标题 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述 *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="一句话总结，用于 SEO 和列表"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">日期 *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">作者 *</Label>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">标签</Label>
            <Input
              id="tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="rsc, cloudflare, deploy"
            />
            <p className="text-xs text-muted-foreground">逗号分隔</p>
          </div>

          <div className="space-y-2">
            <Label>封面图</Label>
            <ImageUploader value={coverImage} onChange={setCoverImage} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">正文 *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="段落之间用空行分隔..."
              className="min-h-[260px] font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            {isPending && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                发布中...
              </span>
            )}
            <Button asChild variant="ghost">
              <Link href="/admin">取消</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "发布中..." : "发布"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
