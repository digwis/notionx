import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";

// 部署后 vinext 会注入真实 host 到环境变量。先给一个 fallback。
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinext-blog.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly" },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly" },
  ];
  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly",
  }));
  return [...staticRoutes, ...postRoutes];
}
