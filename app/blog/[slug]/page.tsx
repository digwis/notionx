import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getPostSlugs } from "@/lib/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import { ArrowLeft, BookOpen, Shield } from "lucide-react";

type Props = {
  params: Promise<{ slug: string }>;
};

// 边缘节点 ISR：所有 published 文章每 300s 重新生成一次。
// 配合管理员审核后 revalidatePath('/blog') / revalidatePath(`/blog/${slug}`) 立即失效。
export const revalidate = 300;
// 允许运行时新发现的 slug 自动进入 ISR 缓存（不再 fallback 到动态渲染）
export const dynamicParams = true;

// 预渲染构建时已知的 slug 路径
export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

// 动态 metadata，per-post 标题和描述（SEO）
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

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
              <Link href="/login">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/blog">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to all posts
          </Link>
        </Button>

        <article>
          {post.cover_image && (
            <div className="mb-8 aspect-[2/1] w-full overflow-hidden rounded-lg border bg-muted">
              <PublicCoverImage
                src={post.cover_image}
                alt={post.title}
                sizes="(max-width: 768px) 100vw, 768px"
                className="h-full w-full object-cover"
                index={0}
                variant="detail"
              />
            </div>
          )}
          <header className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              {post.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <time dateTime={post.date}>{post.date}</time>
              <span>·</span>
              <span>{post.author}</span>
              {post.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </header>

          <Separator className="my-6" />

          <div className="prose prose-neutral max-w-none dark:prose-invert">
            {post.content.map((paragraph, i) => (
              <p
                key={i}
                className="mb-5 leading-7 text-foreground/90"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
