import type { MetadataRoute } from "next";
import {
  localizedMovieDetailPath,
  localizedMovieListPath,
  supportedLocales,
  type AppLocale,
} from "@/lib/i18n/config";
import { getPublishedMovieTranslations } from "@/lib/notion/movie-translations";
import { getNotionPostsMeta } from "@/lib/notion/posts";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [posts, translations] = await Promise.all([
    getNotionPostsMeta(),
    getPublishedMovieTranslations(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly" },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
    },
    ...supportedLocales.map((locale) => ({
      url: `${siteUrl}${localizedMovieListPath(locale)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
    })),
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
  }));

  const movieRoutes: MetadataRoute.Sitemap = translations.map((translation) => ({
    url: `${siteUrl}${localizedMovieDetailPath(
      translation.locale as AppLocale,
      translation.slug
    )}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
  }));

  return [...staticRoutes, ...postRoutes, ...movieRoutes];
}
