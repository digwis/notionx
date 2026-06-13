// Notion-backed site settings loader.
//
// Reads the singleton row from the `site-settings` Notion data
// source (declared in `lib/content/models.ts`) and merges it with
// the static fallback in `./config.ts`. The result has the same
// shape as `siteConfig` so call sites don't need to know which
// source actually answered.
//
// Caching strategy:
//   - One KV read per request. On miss, fetch from Notion, cache
//     the merged result for 5 minutes, and return.
//   - The first request after a Notion edit pays the Notion RTT
//     (~150ms in our measurements); subsequent requests in the
//     5-minute window are KV reads (~5ms).
//
// To invalidate early after editing Notion, you have two options:
//   1. Wait up to 5 minutes (the default TTL).
//   2. Hit `POST /api/admin/site-settings/revalidate` (mounted by
//      the worker when an admin session is present) which clears
//      the KV entry. The endpoint re-uses
//      `@notionx/core/auth/routes/viewer` to authorize the caller.
//
// If the Notion data source is empty or the row can't be read,
// `fallbackSiteConfig` from `./config.ts` is returned unchanged.
// The fallback is also what `getStaticSiteSettings()` returns
// synchronously — useful for places that can't `await` (e.g.
// a `generateMetadata` shortcut that builds an error page).

import { getRequestEnv } from "./request-env";
import {
  hasNotionModelConfig,
  listGenericNotionContent,
} from "@notionx/core/notion";
import { siteSettingsSource } from "../content/models";
import { fallbackSiteConfig, type SiteConfig } from "./config";

const CACHE_KEY = "site-settings:v1";
const CACHE_TTL_SECONDS = 5 * 60;

/**
 * Read the `CONTENT_CACHE` KV binding from the current request, if
 * any. Returns `null` when called outside a request scope (build
 * scripts, tests, one-off scripts) — callers must handle that and
 * skip caching rather than throwing.
 */
function readKv(): KVNamespace | null {
  return getRequestEnv()?.CONTENT_CACHE ?? null;
}

type RawNavItem = {
  label: string;
  href: string;
  children?: RawNavItem[];
};

type RawSiteSettings = {
  name?: string;
  tagline?: string;
  description?: string;
  defaultLocale?: string;
  socialImageUrl?: string;
  ogImageUrl?: string;
  seo?: { title?: string; description?: string };
  navigation?: {
    main?: RawNavItem[];
    cta?: { label: string; href: string } | null;
  };
  theme?: { primary?: string; accent?: string; font?: string };
  footer?: {
    columns?: Array<{ label: string; items: Array<{ label: string; href: string }> }>;
    social?: Array<{ label: string; href: string }>;
    tagline?: string;
    copyright?: string;
  };
};

function readRichText(
  properties: Record<string, unknown>,
  field: string
): string {
  const prop = properties[field] as
    | { rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  if (!prop?.rich_text?.length) return "";
  return prop.rich_text.map((t) => t.plain_text ?? "").join("").trim();
}

function readUrl(
  properties: Record<string, unknown>,
  field: string
): string | null {
  const prop = properties[field] as
    | { url?: string | null }
    | undefined;
  return prop?.url ?? null;
}

function readSelect(
  properties: Record<string, unknown>,
  field: string
): string {
  const prop = properties[field] as
    | { select?: { name?: string } | null }
    | undefined;
  return prop?.select?.name?.trim() ?? "";
}

function readJson<T>(
  properties: Record<string, unknown>,
  field: string,
  fallback: T
): T {
  const raw = readRichText(properties, field);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Synchronous build-time copy. Use this only when `await` is not
 * possible (rare — prefer `getSiteSettings`). Returns the
 * hard-coded fallback, no Notion I/O.
 */
export function getStaticSiteSettings(): SiteConfig {
  return fallbackSiteConfig;
}

/**
 * Resolve the current site settings.
 *
 * Order of precedence for each field:
 *   1. Notion row (if `site-settings` data source is reachable and
 *      contains a row)
 *   2. `fallbackSiteConfig` (so a Notion outage never breaks the
 *      home page or SEO metadata)
 *
 * The result is cached in `CONTENT_CACHE` (KV) under
 * `site-settings:v1` for 5 minutes per process. Bump the cache key
 * suffix to invalidate globally after a breaking schema change.
 */
export async function getSiteSettings(): Promise<SiteConfig> {
  const kv = readKv();
  if (kv) {
    const cached = await kv.get<SiteConfig>(CACHE_KEY, "json");
    if (cached) return cached;
  }

  const merged = await loadFromNotion();

  if (kv) {
    // Best-effort write. KV failure shouldn't break the page.
    kv.put(CACHE_KEY, JSON.stringify(merged), {
      expirationTtl: CACHE_TTL_SECONDS,
    }).catch(() => {});
  }

  return merged;
}

async function loadFromNotion(): Promise<SiteConfig> {
  // `hasNotionModelConfig` reads the env from the active request
  // context. If Notion isn't configured we return the fallback
  // untouched — never throw, so the home page can't 500 because of
  // a CMS blip.
  let configured = false;
  try {
    configured = await hasNotionModelConfig(siteSettingsSource);
  } catch {
    configured = false;
  }
  if (!configured) {
    return fallbackSiteConfig;
  }

  let items: Awaited<
    ReturnType<typeof listGenericNotionContent<typeof siteSettingsSource.source.fields>>
  >;
  try {
    items = await listGenericNotionContent(siteSettingsSource);
  } catch {
    return fallbackSiteConfig;
  }
  if (!items.length) {
    return fallbackSiteConfig;
  }

  // The first published row wins. If the operator has multiple
  // rows they can pick the active one by checking `Published` in
  // Notion; we deliberately don't try to be clever about which row
  // is "active" beyond that to keep the model predictable.
  const row = items[0];
  if (!row) return fallbackSiteConfig;

  const raw: RawSiteSettings = {
    name: row.title || undefined,
    tagline: row.properties.tagline
      ? Array.isArray(row.properties.tagline)
        ? row.properties.tagline[0]
        : (row.properties.tagline as string)
      : undefined,
    description: row.description || undefined,
    socialImageUrl: row.coverImage || undefined,
  };

  // The Notion mapper doesn't know about every field we expose
  // (e.g. `defaultLocale` lives in a `Select` column). Read it
  // straight off the raw Notion page object that
  // `listGenericNotionContent` returns — its `properties` map
  // includes everything Notion sent us, not just the mapped ones.
  const extra = (row as unknown as { properties?: Record<string, unknown> })
    .properties;
  if (extra && typeof extra === "object") {
    const defaultLocale = readSelect(extra, "Default Locale");
    if (defaultLocale) raw.defaultLocale = defaultLocale;
    const tagline = readRichText(extra, "Tagline");
    if (tagline) raw.tagline = tagline;
    const socialImage = readUrl(extra, "Social Image");
    if (socialImage) raw.socialImageUrl = socialImage;

    // SEO
    const metaTitle = readRichText(extra, "Meta Title");
    const metaDescription = readRichText(extra, "Meta Description");
    if (metaTitle || metaDescription) {
      raw.seo = {
        title: metaTitle || raw.name,
        description: metaDescription || raw.description,
      };
    }
    const ogImage = readUrl(extra, "OG Image");
    if (ogImage) raw.ogImageUrl = ogImage;

    // Navigation
    const nav = readJson<RawNavItem[]>(extra, "Nav", []);
    const cta = readJson<{ label: string; href: string } | null>(
      extra,
      "Nav CTA",
      null
    );
    raw.navigation = { main: nav, cta };

    // Theme
    const primary = readSelect(extra, "Primary Color");
    const accent = readSelect(extra, "Accent Color");
    const font = readSelect(extra, "Font Family");
    if (primary || accent || font) {
      raw.theme = { primary, accent, font };
    }

    // Footer
    type FooterColumn = {
      label: string;
      items: Array<{ label: string; href: string }>;
    };
    const columns = readJson<FooterColumn[]>(extra, "Footer Columns", []);
    const social = readJson<Array<{ label: string; href: string }>>(
      extra,
      "Footer Social Links",
      []
    );
    const taglineFooter = readRichText(extra, "Footer Tagline");
    const copyright = readRichText(extra, "Footer Copyright");
    raw.footer = { columns, social, tagline: taglineFooter, copyright };
  }

  return {
    ...fallbackSiteConfig,
    name: raw.name?.trim() || fallbackSiteConfig.name,
    tagline: raw.tagline?.trim() || raw.name?.trim() || fallbackSiteConfig.tagline,
    description:
      raw.description?.trim() || fallbackSiteConfig.description,
    socialImageUrl: raw.socialImageUrl ?? fallbackSiteConfig.socialImageUrl,
    ogImageUrl: raw.ogImageUrl ?? raw.socialImageUrl ?? fallbackSiteConfig.ogImageUrl,
    defaultLocale:
      raw.defaultLocale?.trim() || fallbackSiteConfig.defaultLocale,
    seo: {
      title: raw.seo?.title?.trim() || fallbackSiteConfig.seo.title,
      description:
        raw.seo?.description?.trim() || fallbackSiteConfig.seo.description,
    },
    navigation: {
      ...fallbackSiteConfig.navigation,
      main: raw.navigation?.main?.length
        ? (raw.navigation.main.map((item) => ({
            ...item,
            // @notionx/core 1.0 requires modelId on every NavItem; the
            // Notion data source doesn't store it, so coerce a stable
            // empty string here. Renders that need a real modelId can
            // resolve it at the call site.
            modelId: (item as { modelId?: string }).modelId ?? "",
          })) as SiteConfig["navigation"]["main"])
        : fallbackSiteConfig.navigation.main,
      cta: raw.navigation?.cta ?? fallbackSiteConfig.navigation.cta,
    },
    theme: {
      primary:
        (raw.theme?.primary as SiteConfig["theme"]["primary"]) ??
        fallbackSiteConfig.theme.primary,
      accent:
        (raw.theme?.accent as SiteConfig["theme"]["accent"]) ??
        fallbackSiteConfig.theme.accent,
      font:
        (raw.theme?.font as SiteConfig["theme"]["font"]) ??
        fallbackSiteConfig.theme.font,
    },
    footer: {
      columns: raw.footer?.columns ?? fallbackSiteConfig.footer.columns,
      social: raw.footer?.social ?? fallbackSiteConfig.footer.social,
      tagline: raw.footer?.tagline ?? fallbackSiteConfig.footer.tagline,
      copyright:
        raw.footer?.copyright ?? fallbackSiteConfig.footer.copyright,
    },
  };
}

/**
 * Drop the cached entry. Call this from a Notion webhook handler
 * (or an admin "revalidate" button) so editors see their changes
 * without waiting for the 5-minute TTL.
 */
export async function invalidateSiteSettingsCache(): Promise<void> {
  const kv = readKv();
  if (!kv) return;
  await kv.delete(CACHE_KEY);
}
