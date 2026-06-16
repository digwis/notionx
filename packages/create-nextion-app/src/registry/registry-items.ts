// packages/create-nextion-app/src/registry/registry-items.ts
//
// The built-in `@notionx/official` catalog. Each entry is a
// `RegistryItem` description — *what the item is, what files it
// contributes, what capabilities it exposes, and how to migrate it*.
// No file *content* lives here; that stays inside the templates
// directory and is loaded by `render.ts`.
//
// Each `RegistryFile` has a `template` path (relative to the
// templates directory) that the renderer reads, substitutes tokens
// into, and writes to the file's `path` (relative to the project
// root). Files without a `template` are skipped by the renderer
// (they may be created by other means, e.g. provision).

import type { RegistryItem } from "./registry-types.js";

const OFFICIAL_REGISTRY = "@notionx/official" as const;
const OFFICIAL_URL = "https://registry.notionx.dev/official.json" as const;
const PUBLISHED_AT = "2026-06-16T00:00:00.000Z" as const;

const officialSource: RegistryItem["source"] = {
  kind: "official",
  name: OFFICIAL_REGISTRY,
};

const items: RegistryItem[] = [
  {
    id: "blog",
    kind: "content-source",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: { contentSourceId: "blog" },
    files: [
      {
        path: "app/blog/page.tsx",
        ownership: "user",
        template: "app/{{contentSourceListPath}}/page.tsx.tmpl",
      },
      {
        path: "app/blog/[slug]/page.tsx",
        ownership: "user",
        template: "app/{{contentSourceListPath}}/[slug]/page.tsx.tmpl",
      },
      {
        path: "app/api/blog/route.ts",
        ownership: "user",
        template: "app/api/{{contentSourceId}}/route.ts.tmpl",
      },
      {
        path: "app/api/blog/[slug]/route.ts",
        ownership: "user",
        template: "app/api/{{contentSourceId}}/[slug]/route.ts.tmpl",
      },
    ],
    capabilities: {
      publicRoutes: ["/blog", "/blog/[slug]"],
      apiRoutes: ["/api/blog", "/api/blog/[slug]"],
      envVars: ["NOTION_BLOG_DATA_SOURCE_ID"],
      notionDataSources: ["NOTION_BLOG_DATA_SOURCE_ID"],
      contentSourceIds: ["blog"],
    },
    migrations: [],
  },
  {
    id: "docs",
    kind: "content-source",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: { contentSourceId: "docs", basePath: "/docs" },
    files: [
      {
        path: "app/docs/page.tsx",
        ownership: "user",
        template: "app/{{contentSourceListPath}}/page.tsx.tmpl",
      },
      {
        path: "app/docs/[slug]/page.tsx",
        ownership: "user",
        template: "app/{{contentSourceListPath}}/[slug]/page.tsx.tmpl",
      },
      {
        path: "app/api/docs/route.ts",
        ownership: "user",
        template: "app/api/{{contentSourceId}}/route.ts.tmpl",
      },
      {
        path: "app/api/docs/[slug]/route.ts",
        ownership: "user",
        template: "app/api/{{contentSourceId}}/[slug]/route.ts.tmpl",
      },
    ],
    capabilities: {
      publicRoutes: ["/docs", "/docs/[slug]"],
      apiRoutes: ["/api/docs", "/api/docs/[slug]"],
      envVars: ["NOTION_DOCS_DATA_SOURCE_ID"],
      notionDataSources: ["NOTION_DOCS_DATA_SOURCE_ID"],
      contentSourceIds: ["docs"],
    },
    migrations: [],
  },
  {
    id: "site-settings",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enableSiteSettings",
    files: [
      {
        path: "lib/site/settings.ts",
        ownership: "bridge",
        template: "lib/site/settings.ts.tmpl",
        fallbackTemplate: "lib/site/settings.fallback.ts.tmpl",
      },
    ],
    capabilities: {
      envVars: ["NOTION_SITE_SETTINGS_DATA_SOURCE_ID"],
      notionDataSources: ["NOTION_SITE_SETTINGS_DATA_SOURCE_ID"],
    },
    migrations: [],
  },
  {
    id: "blocks",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enableBlocks",
    files: [
      {
        path: "components/page-blocks.tsx",
        ownership: "bridge",
        template: "components/page-blocks.tsx.tmpl",
        fallbackTemplate: "components/page-blocks.fallback.tsx.tmpl",
      },
      {
        path: "components/page-blocks/hero-block.tsx",
        ownership: "user",
        template: "components/page-blocks/hero-block.tsx.tmpl",
      },
      {
        path: "components/page-blocks/feature-grid-block.tsx",
        ownership: "user",
        template: "components/page-blocks/feature-grid-block.tsx.tmpl",
      },
      {
        path: "components/page-blocks/story-block.tsx",
        ownership: "user",
        template: "components/page-blocks/story-block.tsx.tmpl",
      },
      {
        path: "components/page-blocks/latest-posts-block.tsx",
        ownership: "user",
        template: "components/page-blocks/latest-posts-block.tsx.tmpl",
      },
    ],
    capabilities: {
      envVars: ["NOTION_BLOCKS_DATA_SOURCE_ID"],
      notionDataSources: ["NOTION_BLOCKS_DATA_SOURCE_ID"],
    },
    migrations: [],
  },
  {
    id: "auth",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enableAuth",
    files: [
      {
        path: "lib/auth.config.ts",
        ownership: "bridge",
        template: "lib/auth.config.ts.tmpl",
        fallbackTemplate: "lib/auth.config.fallback.ts.tmpl",
      },
      {
        path: "app/api/auth/google/route.ts",
        ownership: "bridge",
        template: "app/api/auth/google/route.ts.tmpl",
      },
      {
        path: "app/api/auth/google/callback/route.ts",
        ownership: "bridge",
        template: "app/api/auth/google/callback/route.ts.tmpl",
      },
      {
        path: "app/api/auth/verify-email/route.ts",
        ownership: "bridge",
        template: "app/api/auth/verify-email/route.ts.tmpl",
      },
      {
        path: "app/api/auth/viewer/route.ts",
        ownership: "bridge",
        template: "app/api/auth/viewer/route.ts.tmpl",
      },
      {
        path: "app/login/page.tsx",
        ownership: "user",
        template: "app/login/page.tsx.tmpl",
      },
      {
        path: "app/register/page.tsx",
        ownership: "user",
        template: "app/register/page.tsx.tmpl",
      },
    ],
    capabilities: {
      envVars: [
        "TURNSTILE_SITE_KEY",
        "TURNSTILE_SECRET_KEY",
        "RESEND_FROM",
        "RESEND_API_KEY",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
      ],
    },
    migrations: [],
  },
  {
    id: "admin",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enableAdmin",
    requires: [{ id: "auth", version: "^1.0.0" }],
    files: [
      {
        path: "app/admin/layout.tsx",
        ownership: "bridge",
        template: "app/admin/layout.tsx.tmpl",
      },
      {
        path: "app/admin/page.tsx",
        ownership: "bridge",
        template: "app/admin/page.tsx.tmpl",
      },
      {
        path: "app/admin/loading.tsx",
        ownership: "bridge",
        template: "app/admin/loading.tsx.tmpl",
      },
      {
        path: "app/admin/account/page.tsx",
        ownership: "bridge",
        template: "app/admin/account/page.tsx.tmpl",
      },
      {
        path: "app/admin/content-models/page.tsx",
        ownership: "bridge",
        template: "app/admin/content-models/page.tsx.tmpl",
      },
      {
        path: "lib/admin/nav.ts",
        ownership: "bridge",
        template: "lib/admin/nav.ts.tmpl",
      },
      {
        path: "lib/admin/actions.ts",
        ownership: "bridge",
        template: "lib/admin/actions.ts.tmpl",
      },
      {
        path: "lib/admin/context.tsx",
        ownership: "bridge",
        template: "lib/admin/context.tsx.tmpl",
      },
    ],
    capabilities: {},
    migrations: [],
  },
  {
    id: "pages",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enablePages",
    requires: [{ id: "blocks", version: "^1.0.0" }],
    files: [
      {
        path: "lib/pages/model.ts",
        ownership: "bridge",
        template: "lib/pages/model.ts.tmpl",
      },
      {
        path: "lib/pages/source.ts",
        ownership: "bridge",
        template: "lib/pages/source.ts.tmpl",
      },
      {
        path: "app/[slug]/page.tsx",
        ownership: "bridge",
        template: "app/[slug]/page.tsx.tmpl",
      },
      {
        path: "app/page.tsx",
        ownership: "user",
        template: "app/page.tsx.tmpl",
        fallbackTemplate: "app/page.fallback.tsx.tmpl",
      },
    ],
    capabilities: {
      envVars: ["NOTION_PAGES_DATA_SOURCE_ID"],
      notionDataSources: ["NOTION_PAGES_DATA_SOURCE_ID"],
    },
    migrations: [],
  },
  {
    id: "search",
    kind: "feature-module",
    version: 1,
    source: officialSource,
    publishedAt: PUBLISHED_AT,
    params: {},
    featureFlag: "enableSearch",
    files: [
      {
        path: "lib/search/config.ts",
        ownership: "bridge",
        template: "lib/search/config.ts.tmpl",
        fallbackTemplate: "lib/search/config.fallback.ts.tmpl",
      },
      {
        path: "components/search/search-dialog.tsx",
        ownership: "user",
        template: "components/search/search-dialog.tsx.tmpl",
      },
      {
        path: "migrations/0003_search_index.sql",
        ownership: "bridge",
        template: "migrations/0003_search_index.sql.tmpl",
      },
    ],
    capabilities: {
      apiRoutes: ["/api/search"],
      d1Tables: ["content_search_index"],
    },
    migrations: [],
  },
];

export function listOfficialItems(): RegistryItem[] {
  return items.map((item) => ({ ...item }));
}

export function getOfficialItem(id: string): RegistryItem | undefined {
  const found = items.find((item) => item.id === id);
  return found ? { ...found } : undefined;
}

export const OFFICIAL_REGISTRY_NAME = OFFICIAL_REGISTRY;
export const OFFICIAL_REGISTRY_URL = OFFICIAL_URL;
