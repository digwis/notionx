# The current contracts

These are the main public boundaries between a consumer project and
`@notionx/core`. Check the source if in doubt:

- `packages/nextion/src/content/models.ts`
- `packages/nextion/src/types.ts`
- `packages/nextion/src/admin/nav.ts`
- `packages/nextion/src/worker/bootstrap.ts`

## 1. `ContentSource`

Import from `@notionx/core/content`. Built with `defineContentSource({...})`.
It registers a Notion-backed content source in the package registry and returns
the same value unchanged.

```ts
import {
  defineContentSource,
  type ContentSource,
} from "@notionx/core/content";

export const blogSource: ContentSource = defineContentSource({
  id: "blog",
  kind: "article", // "article" | "catalog" | "directory"
  visibility: { public: true, admin: true },
  source: {
    type: "notion",
    tokenEnv: "NOTION_TOKEN",
    dataSourceEnv: "NOTION_DATA_SOURCE_ID",
    defaultDataSourceId: undefined,
    fields: {
      title: "Name",
      slug: "Slug",
      description: "Description",
      published: "Published",
      date: "Date",
      tags: "Tags",
      cover: "Cover",
    },
    query: {
      pageSize: 50,
      // sorts?: readonly NotionSort[]
      // filterProperties?: readonly string[]
    },
  },
  routes: {
    listPath: "/blog",
    detailPath: "/blog/[slug]",
    detailParam: "slug",
    publicApiPath: "/api/blog",
  },
  ui: {
    name: "Blog",
    pluralName: "Blogs",
    navLabel: "Blog",
    listTitle: "Blog",
    listDescription: "Blog posts backed by Notion.",
    emptyState: "No blog posts published yet.",
  },
  capabilities: {
    richBlocks: true,
    coverImages: true,
    gatedAssets: false,
  },
});

export const contentSources = [blogSource] as const;
```

Important details:

- Current scaffolds export `contentSources`, not `contentModels`.
- Registering the same `id` replaces the prior registry value, which helps HMR
  and tests.
- The package can list registered sources for admin/status/search/revalidation,
  but the project still owns public pages, optional public APIs, and UI.

## 2. `AuthConfig`

Import from `@notionx/core/types`. It is a plain object consumed by auth helpers
and worker middleware. Current generated projects look like this:

```ts
import type { AuthConfig } from "@notionx/core/types";

export const authConfig: AuthConfig = {
  databaseBinding: "DB",
  tables: {
    users: "users",
    sessions: "sessions",
    passwordResets: "password_resets",
    emailVerifications: "email_verifications",
    authRateLimits: "auth_rate_limits",
  },
  sessionCookie: {
    name: "vinext_session",
    maxAge: 60 * 60 * 24 * 7,
    secure: true,
  },
  turnstile: {
    siteKeyEnv: "TURNSTILE_SITE_KEY",
    secretKeyEnv: "TURNSTILE_SECRET_KEY",
  },
  email: {
    provider: "resend",
    fromEnv: "RESEND_FROM",
    apiKeyEnv: "RESEND_API_KEY",
  },
  oauth: {
    google: {
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    },
  },
  roles: { default: "user", vip: "vip", admin: "admin" },
  password: { minLength: 8 },
};
```

Do not use older field names such as `database`, `cookie.maxAgeSeconds`,
`turnstile.enabled`, `email.fromAddress`, or `google.enabled` unless the local
source code proves that project is on an older API.

## 3. Admin navigation

Import `createAdminNav` from `@notionx/core/admin`. It sorts by `order` and
filters by `requireRole`; the project only declares items.

```ts
import { createAdminNav } from "@notionx/core/admin";

export const adminNav = createAdminNav([
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: "Home", order: 10 },
  { href: "/admin/content-models", labelKey: "admin.nav.models", icon: "Database", order: 20 },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: "Users", requireRole: "admin", order: 40 },
  { href: "/admin/settings", labelKey: "admin.nav.settings", icon: "Settings", requireRole: "admin", order: 50 },
  { href: "/admin/account", labelKey: "admin.nav.account", icon: "User", order: 60 },
]);
```

Use lucide icon names. Add domain-specific admin entries only when there is a
real page under `app/admin/<domain>`.

## 4. `createNextionWorker` options

Import from `@notionx/core/worker`. The current generated `worker/index.ts`
creates a nextion worker first and falls through to vinext for app-router pages:

```ts
import handler from "vinext/server/app-router-entry";
import { createNextionWorker } from "@notionx/core/worker";
import { authConfig } from "../lib/auth.config";
import { adminNav } from "../lib/admin/nav";
import { siteConfig } from "../lib/site/config";
import { blogSource } from "../lib/content/models";

const nextion = createNextionWorker({
  sources: [blogSource],
  adminNav,
  authConfig,
  siteConfig: {
    name: siteConfig.name,
    description: siteConfig.description,
    defaultLocale: siteConfig.defaultLocale,
    locales: [...siteConfig.locales],
    navigation: siteConfig.navigation.main as unknown as unknown[],
  },
  // sessionLookup?: passed to middleware when custom session resolution is needed
  // extraRoutes?: { "/api/custom": () => import("../app/api/custom/route-worker") }
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const nextionResponse = await nextion.fetch(request, env, ctx);
    if (nextionResponse) return nextionResponse;
    return handler.fetch(request, env, ctx);
  },
};
```

The package-owned worker currently handles routes such as `/api/health`,
`/api/notion/media/*`, `/api/files/*`, `/api/cdn/*`, and admin gating before
fallthrough. Do not duplicate those in the consumer unless the user is replacing
the package behavior intentionally.
