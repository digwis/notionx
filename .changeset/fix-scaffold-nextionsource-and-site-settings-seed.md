---
"@notionx/create-nextion-app": patch
---

Fix two scaffolder bugs that broke fresh installs against `@notionx/core` >= 0.2.0:

- `nextionSource` default was hardcoded to `^0.1.2`, which silently
  produced generated `package.json` files that `pnpm install`
  rejected with `ERR_PNPM_NO_MATCHING_VERSION`. The default now
  reads the live version from `https://registry.npmjs.org/@notionx/core/latest`
  (5 s timeout, hardcoded fallback to `^0.5.2` if the registry is
  unreachable) so a fresh scaffold always matches whatever is
  actually published. Override with `--nextion-source=<range>` to
  pin a specific version.
- The site-settings seed row was being created with
  `parent: { type: "database_id", ... }`. Notion's 2025-09-03 schema
  rejects this with `validation_error` and the seed step quietly
  reported "0 page", so the home page rendered with
  `fallbackSiteConfig` instead of the operator's real site name.
  The seed now uses `parent: { type: "data_source_id", ... }`,
  matching how the content source provisioner was already creating
  pages.
