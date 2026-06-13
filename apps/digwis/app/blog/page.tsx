// Public list page for the first content source (default: blog).
// The list itself is a content-source route, while its page title,
// SEO copy, nav placement, and shell visibility can be edited through
// the Notion-backed Pages model.

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { listGenericNotionContent } from "@notionx/core/notion";
import { blogSource } from "@/lib/content/models";
import { Badge } from "@/components/ui/badge";
import { SiteShell } from "@/components/site/site-shell";
import { getSitePageForContentSource } from "@/lib/pages/source";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePageForContentSource("blog");
  return {
    title: page?.seoTitle || page?.title || "Blog",
    description:
      page?.seoDescription || page?.description || "Blog posts backed by Notion metadata and page body content.",
  };
}

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

export default async function blogContentModelPage() {
  const items = await listGenericNotionContent(blogSource);
  const page = await getSitePageForContentSource("blog");
  const title = page?.title || "Blog";
  const description = page?.description || "Blog posts backed by Notion metadata and page body content.";

  if (items.length === 0) {
    return (
      <SiteShell
        showHeader={page?.showHeader ?? true}
        showFooter={page?.showFooter ?? true}
      >
        <main className="container mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 text-muted-foreground">{description}</p>
          <div className="mt-12 rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No blog posts published yet.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              在 Notion 中把 <code>Blog</code> 行的{" "}
              <code>Published</code> 勾选后，会自动出现在这里。
            </p>
          </div>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell
      showHeader={page?.showHeader ?? true}
      showFooter={page?.showFooter ?? true}
    >
      <main className="container mx-auto max-w-4xl px-4 py-16">
        <header className="mb-12 space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </header>

        <ul className="grid gap-6">
          {items.map((item) => (
            <li key={item.pageId}>
              <Link
                href={`/blog/${item.slug}`}
                className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/30"
              >
                {item.coverImage ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                    <Image
                      src={item.coverImage}
                      alt={item.title}
                      fill
                      sizes="(min-width: 768px) 768px, 100vw"
                      className="object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  </div>
                ) : null}
                <div className="space-y-3 p-6">
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
                  <h2 className="text-2xl font-semibold tracking-tight group-hover:underline">
                    {item.title}
                  </h2>
                  {item.description ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </SiteShell>
  );
}
