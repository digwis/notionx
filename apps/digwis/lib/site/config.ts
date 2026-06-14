// Static fallback for the Notion-backed site settings.
//
// `getSiteSettings()` (in `./settings.ts`) reads from a dedicated
// Notion data source, but every consumer in the project still uses
// the `siteConfig` shape below. We keep two copies on purpose:
//
//   1. Notion is the editor surface — operators tweak site name /
//      tagline / description / SEO / navigation / theme / footer
//      there without redeploying.
//   2. The values below are the *last-resort fallback* if Notion
//      is unreachable or the data source is empty.
//
// If you only want the static copy (no Notion), delete
// `lib/site/settings.ts` and the `siteSettingsSource` entry in
// `lib/content/models.ts`, then point the pages at `siteConfig`
// directly again. The repo is intentionally structured so that
// removing Notion is a 3-line change.

import { contentSources } from "../content/models.ts";

export const fallbackSiteConfig = {
  name: "digwis",
  description:
    "A Notion-powered site built on @notionx/core, running on Cloudflare Workers with D1, R2, and Cloudflare Images.",
  tagline: "digwis",
  defaultLocale: "en",
  socialImageUrl: null as string | null,
  ogImageUrl: null as string | null,
  locales: ["en"],
  seo: {
    title: "digwis",
    description:
      "A Notion-powered site built on @notionx/core, running on Cloudflare Workers with D1, R2, and Cloudflare Images.",
  },
  navigation: {
    main: [
      {
        label: "Blog",
        href: "/blog",
        modelId: "blog",
      },
    ],
    cta: null as { label: string; href: string } | null,
    adminHref: "/login",
  },
  theme: {
    primary: "slate" as
      | "slate"
      | "gray"
      | "zinc"
      | "red"
      | "orange"
      | "amber"
      | "green"
      | "blue",
    accent: "blue" as
      | "slate"
      | "gray"
      | "zinc"
      | "red"
      | "orange"
      | "amber"
      | "green"
      | "blue",
    font: "inter" as "inter" | "geist" | "system",
  },
  footer: {
    columns: [] as Array<{
      label: string;
      items: Array<{ label: string; href: string }>;
    }>,
    social: [] as Array<{ label: string; href: string }>,
    tagline: "",
    copyright: `© ${new Date().getFullYear()} digwis`,
  },
  primarySourceId: "blog",
  sources: contentSources,
};

export type SiteConfig = typeof fallbackSiteConfig;

/**
 * `siteConfig` is preserved as an alias for `fallbackSiteConfig` so
 * existing imports (`import { siteConfig } from "@/lib/site/config"`)
 * keep working. New code should prefer `getSiteSettings()` from
 * `./settings.ts` for runtime values, and `fallbackSiteConfig` only
 * when an async read is impossible (e.g. inside `generateMetadata`
 * for routes that need a synchronous title). See
 * `app/layout.tsx` for the async pattern.
 */
export const siteConfig: SiteConfig = fallbackSiteConfig;
export default siteConfig;
