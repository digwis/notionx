"use client";

// EditPostForm - Client Component 包装编辑表单
//
// 原因：ImageUploader v3 是受控组件（value/onChange），需要 useState 持有 cover_image。
// 表单其它字段也用 state，submit 时一次性塞进 FormData。
// 这样 React 19 form action 不会因为受控 state 同步问题丢数据。

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { updatePostAction } from "@/lib/actions";
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
  slug: string;
  initial: {
    title: string;
    description: string;
    date: string;
    author: string;
    tags: string[];
    content: string[];
    cover_image: string | null;
  };
  error?: string;
};

export default function EditPostForm({ slug, initial, error }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 所有字段都在 state，submit 时一次性 serialize
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [date, setDate] = useState(initial.date);
  const [author, setAuthor] = useState(initial.author);
  const [tagsStr, setTagsStr] = useState(initial.tags.join(", "));
  const [content, setContent] = useState(initial.content.join("\n\n"));
  const [coverImage, setCoverImage] = useState(initial.cover_image ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    fd.set("date", date);
    fd.set("author", author);
    fd.set("tags", tagsStr);
    fd.set("content", content);
    // 关键：coverImage 从 state 取，不依赖 hidden input
    fd.set("coverImage", coverImage);

    startTransition(async () => {
      try {
        await updatePostAction(slug, fd);
        // 成功 → 留在原页 + 弹已保存提示
        router.replace(`/admin/${slug}/edit?saved=1`);
        router.refresh();
      } catch (e) {
        // redirect() 内部抛 NEXT_REDIRECT，不算错误
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        console.error("[edit submit error]", e);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
            {slug}
          </code>
        </CardTitle>
        <CardDescription>slug 不可修改。改完点 "保存" 立即生效。</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>无法保存</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="逗号分隔"
            />
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
              className="min-h-[320px] font-mono"
            />
            <p className="text-xs text-muted-foreground">段落之间用空行分隔</p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            {isPending && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                保存中...
              </span>
            )}
            <Button asChild variant="ghost">
              <Link href="/admin">取消</Link>
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
