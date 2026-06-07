import type { Metadata } from "next";
import Link from "next/link";
import { getNotionPostsMeta } from "@/lib/notion/posts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import SubscribeFormLazy from "@/components/SubscribeFormLazy";
import { ArrowRight, BookOpen, Film, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog · vinext on Cloudflare",
  description: "vinext + RSC + D1 + Cloudflare Workers 上的极简博客示例",
};

// 边缘节点 ISR：每 300s 重新生成一次。配合 revalidatePath() 可立即失效。
export const revalidate = 300;

export default async function BlogIndexPage() {
  const posts = await getNotionPostsMeta();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium hover:underline"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            vinext Blog
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/movies">
                <Film className="mr-1 h-3 w-3" />
                Movies
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
          <p className="mt-2 text-muted-foreground">
            关于 vinext、RSC、D1 与 Cloudflare Workers 的笔记。
          </p>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              还没有任何文章。
            </CardContent>
          </Card>
        ) : (
          // 响应式网格：手机 1 列 / 平板 2 列 / 桌面 3 列
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block"
              >
                <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-1 group-hover:border-foreground/30 group-hover:shadow-lg">
                  {post.coverImage ? (
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                      <PublicCoverImage
                        src={post.coverImage}
                        alt={post.title}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        index={index}
                        variant="list"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  ) : (
                    // 没封面图时占位（防止布局抖动）
                    <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}

                  <CardHeader className="flex-1">
                    <CardTitle className="line-clamp-2 text-xl leading-tight group-hover:underline">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {post.tags.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                        {post.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{post.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <time dateTime={post.date}>{post.date}</time>
                        <span>·</span>
                        <span>{post.author}</span>
                      </div>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-16">
          <SubscribeFormLazy />
        </div>
      </main>
    </div>
  );
}
