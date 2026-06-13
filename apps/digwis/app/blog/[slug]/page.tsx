// Public detail page for the first content source (default: blog).
// Resolves a single Notion page by slug and renders its metadata
// header + body content. Uses `notFound()` so the App Router emits
// a 404 for unpublished, missing, or invalid slugs.

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGenericNotionContentBySlug } from "@notionx/core/notion";
import { blogSource } from "@/lib/content/models";
import { Badge } from "@/components/ui/badge";
import { NotionBlocks } from "@/components/notion-blocks";
import { SiteShell } from "@/components/site/site-shell";
import { getSitePageForContentSource } from "@/lib/pages/source";

export const revalidate = 3600;

type Params = { slug: string };

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getGenericNotionContentBySlug(blogSource, slug);
  if (!item) return { title: "Not found" };
  return {
    title: item.title,
    description: item.description,
    openGraph: item.coverImage
      ? { images: [{ url: item.coverImage }] }
      : undefined,
  };
}

export default async function blogContentModelDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const item = await getGenericNotionContentBySlug(blogSource, slug);
  const page = await getSitePageForContentSource("blog");
  if (!item) notFound();

  return (
    <SiteShell
      showHeader={page?.showHeader ?? true}
      showFooter={page?.showFooter ?? true}
    >
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <Link
          href="/blog"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {page?.title || "Blog"}
        </Link>

        <article className="mt-6 space-y-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <time dateTime={item.date}>{formatDate(item.date)}</time>
              {item.tags.length > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{item.title}</h1>
            {item.description ? (
              <p className="text-lg text-muted-foreground">{item.description}</p>
            ) : null}
          </header>

          {item.coverImage ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
              <Image
                src={item.coverImage}
                alt={item.title}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                priority
                className="object-cover"
              />
            </div>
          ) : null}

          <NotionBlocks blocks={item.blocks} />
        </article>
      </main>
    </SiteShell>
  );
}
