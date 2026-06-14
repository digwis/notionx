import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotionBlocks } from "@/components/notion-blocks";
import { SiteShell } from "@/components/site/site-shell";
import { siteConfig } from "@/lib/site/config";
import { getSiteNavigation, getSitePageByKey } from "@/lib/pages/source";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePageByKey("home");
  return {
    title: page?.seoTitle ?? siteConfig.name,
    description: page?.seoDescription ?? siteConfig.description,
    openGraph: page?.coverImage
      ? { images: [{ url: page.coverImage }] }
      : undefined,
  };
}

export default async function Home() {
  const page = await getSitePageByKey("home");
  const nav = await getSiteNavigation();
  const title = page?.title ?? siteConfig.name;
  const description = page?.description ?? siteConfig.description;

  return (
    <SiteShell
      showHeader={page?.showHeader ?? true}
      showFooter={page?.showFooter ?? true}
    >
      <main>
        <section className="container mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
          <Badge variant="outline" className="mb-6 gap-2 px-3 py-1 text-xs font-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Notion Pages + Cloudflare Workers
          </Badge>

          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {description}
          </p>

          {nav.length > 0 ? (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {nav.slice(0, 3).map((item, index) => (
                <Button
                  key={item.href}
                  asChild
                  size="lg"
                  variant={index === 0 ? "default" : "secondary"}
                >
                  <Link href={item.href}>
                    <Database className="mr-2 h-4 w-4" />
                    {item.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        {page?.blocks?.length ? (
          <section className="border-t bg-muted/20">
            <div className="container mx-auto max-w-3xl px-4 py-14">
              <NotionBlocks blocks={page.blocks} />
            </div>
          </section>
        ) : null}
      </main>
    </SiteShell>
  );
}
