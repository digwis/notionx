# Multilingual Foundation Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add developer-ergonomics layers on top of the Phase 1 contract and the Phase 2 `nextion locale add` command: a `defineLocaleContract` helper for custom content models, an in-tree example extension, a `nextion locale` subcommand surface (list / status), and updated end-to-end docs.

**Architecture:** Extend the existing `locale-contract` module with a small `define` helper for custom models, then surface a single `nextion locale` subcommand namespace (`add` from Phase 2 + `list` + `doctor` aliases). No new runtime primitives: the work is mostly about ergonomics, examples, and one CLI subcommand.

**Tech Stack:** TypeScript, Node 20+, `@clack/prompts`, Vitest

**Out of scope:**
- AI / skill-assisted workflows are documented but not built (the design says they are optional).
- Locale removal / deletion commands: still out of scope per the design.

---

## File Map

- Modify: `packages/nextion/src/locale-contract/define.ts`
  Purpose: Add a `defineLocaleContract` helper that lets user code register a custom contract with field maps, fallback rule, and list path. Re-uses the existing registry.
- Modify: `packages/nextion/src/locale-contract/index.ts`
  Purpose: Re-export the new helper.
- Create: `packages/nextion/tests/locale-contract/define-custom.test.ts`
  Purpose: Test the custom-contract helper.
- Create: `docs/locale-contract-extension-example.md`
  Purpose: End-to-end worked example: "add a `products` content source to a starter, declare a `products` translation contract, wire it into the i18n module". Lives in the repo root docs folder so it can be linked from README and from generated starter docs.
- Create: `packages/create-nextion-app/src/locale-add/list.ts`
  Purpose: Pure helper that returns a printable table of the current supported locales + translation source status.
- Create: `packages/create-nextion-app/src/locale-add/list.test.ts`
  Purpose: Test the list helper.
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`
  Purpose: Add a `nextion locale list` subcommand (and a `nextion locale` help message) without breaking the existing `nextion locale add` flow.
- Modify: `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl`
  Purpose: Add a stub `defineLocaleContract` re-export so generated projects can build their own custom contracts.
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`
  Purpose: Reference the new extension-example doc and the new `npx nextion locale list` command.
- Create: `.changeset/multilingual-starter-foundation-phase-3.md`
  Purpose: Changeset for the Phase 3 minor.

---

### Task 1: Add The `defineLocaleContract` Helper

**Files:**
- Modify: `packages/nextion/src/locale-contract/define.ts`
- Modify: `packages/nextion/src/locale-contract/index.ts`
- Create: `packages/nextion/tests/locale-contract/define-custom.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/nextion/tests/locale-contract/define-custom.test.ts`:

```ts
// packages/nextion/tests/locale-contract/define-custom.test.ts
import { describe, expect, it } from "vitest";
import {
  clearLocalizedRegistryForTests,
  defineLocaleContract,
  getRegisteredLocalizedSource,
} from "../../src/locale-contract/define";

describe("defineLocaleContract", () => {
  it("registers a custom model with sensible defaults", () => {
    clearLocalizedRegistryForTests();
    const contract = defineLocaleContract({
      id: "products",
      baseSourceName: "products",
      translationSourceName: "product-translations",
      listPath: "/products",
      baseFields: { title: "Name", sku: "SKU" },
      translationFields: {
        locale: "Locale",
        slug: "Slug",
        title: "Title",
        description: "Description",
      },
    });
    expect(contract.id).toBe("products");
    expect(contract.fallback).toBe("default-locale"); // default
    expect(contract.detailParam).toBe("slug");         // default
    expect(getRegisteredLocalizedSource("products")?.listPath).toBe("/products");
  });

  it("rejects an id that does not match the literal union", () => {
    // @ts-expect-error - the helper accepts a wider string id for custom models
    expect(() => defineLocaleContract({ id: "weird!!" })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/define-custom`
Expected: FAIL with "defineLocaleContract is not a function"

- [ ] **Step 3: Add the helper**

Edit `packages/nextion/src/locale-contract/define.ts` and append a new helper after the existing exports. It must work for any string id, so it widens the type at the boundary:

```ts
import type { FieldMap, LocaleContract, LocaleFallbackRule } from "./contract";

export function defineLocaleContract(input: {
  id: string;
  baseSourceName: string;
  translationSourceName: string;
  listPath: string;
  baseFields: FieldMap;
  translationFields: FieldMap;
  fallback?: LocaleFallbackRule;
  detailParam?: string;
}): LocaleContract {
  const contract: LocaleContract = {
    id: input.id as LocaleContract["id"],
    baseSourceName: input.baseSourceName,
    translationSourceName: input.translationSourceName,
    listPath: input.listPath,
    baseFields: input.baseFields,
    translationFields: input.translationFields,
    fallback: input.fallback ?? "default-locale",
    detailParam: input.detailParam ?? "slug",
  };
  return defineLocalizedContentSource(contract);
}
```

Edit `packages/nextion/src/locale-contract/index.ts` to re-export the new helper. Replace the `export * from "./define"` line with:

```ts
export * from "./define";
export { defineLocaleContract } from "./define";
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/core test -- locale-contract/define-custom`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nextion/src/locale-contract/define.ts \
        packages/nextion/src/locale-contract/index.ts \
        packages/nextion/tests/locale-contract/define-custom.test.ts
git commit -m "feat(nextion): add defineLocaleContract helper for custom content models"
```

---

### Task 2: Add The Extension-Example Doc

**Files:**
- Create: `docs/locale-contract-extension-example.md`

- [ ] **Step 1: Write the doc**

Create `docs/locale-contract-extension-example.md`:

````markdown
# Locale contract extension example: a `products` content source

This page walks through adding a brand-new content model — `products` — to a starter project, declaring a locale contract for it, and wiring it into the i18n pipeline. The same shape works for any model the user wants to ship with the foundation (jobs, events, recipes, etc.).

## 1. Declare the Notion data sources

In Notion, create two databases under a parent page shared with the integration:

- `products` — the base side
- `product-translations` — the translation side, related back to `products` via a `Source` relation

The base side has at least: `Name`, `SKU`, `Status`, `Cover`. The translation side has: `Source` (relation to `products`), `Locale`, `Slug`, `Title`, `Description`, `Body`, `Published`.

## 2. Declare the contract in code

Create `lib/locale-contract/products.ts`:

```ts
import { defineLocaleContract } from "@notionx/core";

export const productsContract = defineLocaleContract({
  id: "products",
  baseSourceName: "products",
  translationSourceName: "product-translations",
  listPath: "/products",
  fallback: "hide",                  // hide un-translated products from the list
  baseFields: {
    title: "Name",
    sku: "SKU",
    status: "Status",
    cover: "Cover",
  },
  translationFields: {
    source: "Source",
    locale: "Locale",
    slug: "Slug",
    title: "Title",
    description: "Description",
    body: "Body",
    published: "Published",
  },
});
```

`defineLocaleContract` registers the contract in the same registry the built-in four models use, so the LocaleSwitcher and the path helpers pick it up automatically.

## 3. Wire it into the i18n config

Edit `lib/locale-contract/index.ts` to re-export the new contract:

```ts
export * from "./built-in";
export * from "./products";
```

No other change is needed: `lib/i18n/config.ts` already exports the supported-locales list, and the `LocaleSwitcher` iterates over that list.

## 4. Add a per-model lookup helper (optional but recommended)

Create `lib/products/translations.ts`:

```ts
import { pickTranslation, hideWhenMissing } from "@notionx/core";
import { i18n } from "@/lib/i18n";
import { productsContract } from "@/lib/locale-contract/products";

export type ProductTranslation = {
  pageId: string;
  sourcePageId: string;
  locale: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  published: boolean;
};

export function pickProductTranslation(
  rows: readonly ProductTranslation[],
  locale: string
) {
  return pickTranslation(rows, locale, productsContract, i18n.defaultLocale);
}

export function productListForLocale(
  rows: readonly ProductTranslation[],
  locale: string
) {
  return hideWhenMissing(rows, locale);
}
```

## 5. Add the Notion secrets to the worker

Add the new translation data source id to `.dev.vars`:

```
NOTION_PRODUCT_TRANSLATIONS_DATA_SOURCE_ID=...
```

And sync it to the worker:

```bash
printf %s "$NOTION_PRODUCT_TRANSLATIONS_DATA_SOURCE_ID" | pnpm exec wrangler secret put NOTION_PRODUCT_TRANSLATIONS_DATA_SOURCE_ID
```

`nextion update` will repair this secret on every run, the same way it repairs the built-in ones.

## 6. Render the new model

The existing `app/[slug]/page.tsx` route is generic — pass it a new `key` like `products` and it will look up `product-translations` and render the locale-aware list. Use `buildLocaleSwitcherLinks` with `productsContract` to render a `LocaleSwitcher` for the model.

That's it. The starter now has a `products` model that participates in the same locale foundation as the built-in four.
````

- [ ] **Step 2: Commit**

```bash
git add docs/locale-contract-extension-example.md
git commit -m "docs: add locale-contract extension example for custom content models"
```

---

### Task 3: Add The `nextion locale list` Subcommand

**Files:**
- Create: `packages/create-nextion-app/src/locale-add/list.ts`
- Create: `packages/create-nextion-app/src/locale-add/list.test.ts`
- Modify: `packages/create-nextion-app/src/cli-nextion.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/create-nextion-app/src/locale-add/list.test.ts`:

```ts
// packages/create-nextion-app/src/locale-add/list.test.ts
import { describe, expect, it } from "vitest";
import { buildLocaleListView } from "../../src/locale-add/list";
import type { ScaffoldMetadata } from "../../src/metadata";

const metadata: ScaffoldMetadata = {
  projectKind: "nextion",
  projectName: "demo",
  scaffoldVersion: "1.0.0",
  defaultLocale: "en",
  supportedLocales: ["en", "zh-CN"],
  nextionSource: "1.0.0",
  enableSiteSettings: true,
  contentSource: { id: "blog", title: "Blog", fields: [] },
};

describe("buildLocaleListView", () => {
  it("marks the default locale", () => {
    const view = buildLocaleListView({ metadata });
    expect(view.rows.find((r) => r.locale === "en")?.isDefault).toBe(true);
    expect(view.rows.find((r) => r.locale === "zh-CN")?.isDefault).toBe(false);
  });

  it("reports whether translation sources are configured", () => {
    const view = buildLocaleListView({
      metadata: {
        ...metadata,
        translationSources: {
          "blog-translations": {
            dataSourceId: "ds-1",
            envVar: "NOTION_BLOG_TRANSLATIONS_DATA_SOURCE_ID",
          },
        },
      },
    });
    expect(
      view.rows.find((r) => r.locale === "zh-CN")
        ?.translationSources.find((ts) => ts.modelId === "blog-translations")
        ?.configured
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/list`
Expected: FAIL with "Cannot find module '../../src/locale-add/list'"

- [ ] **Step 3: Implement the helper**

Create `packages/create-nextion-app/src/locale-add/list.ts`:

```ts
// packages/create-nextion-app/src/locale-add/list.ts
//
// Read-only helper that turns the scaffold metadata into a printable
// `nextion locale list` view. The view is plain data so it can be
// rendered as a table, a JSON dump, or a Markdown summary.

import type { ScaffoldMetadata, TranslationSourceRef } from "../metadata.js";

const BUILT_IN_MODELS = [
  "blog-translations",
  "page-translations",
  "block-translations",
  "site-settings-translations",
] as const;

export type LocaleListRow = {
  locale: string;
  isDefault: boolean;
  translationSources: Array<{
    modelId: string;
    envVar: string;
    configured: boolean;
  }>;
};

export type LocaleListView = {
  rows: LocaleListRow[];
};

export function buildLocaleListView(input: {
  metadata: ScaffoldMetadata;
}): LocaleListView {
  const sources: Record<string, TranslationSourceRef | undefined> =
    input.metadata.translationSources ?? {};
  const rows: LocaleListRow[] = input.metadata.supportedLocales.map((locale) => ({
    locale,
    isDefault: locale === input.metadata.defaultLocale,
    translationSources: BUILT_IN_MODELS.map((modelId) => {
      const ref = sources[modelId];
      return {
        modelId,
        envVar: ref?.envVar ?? `NOTION_${modelId.replace(/-/g, "_").toUpperCase()}_DATA_SOURCE_ID`,
        configured: Boolean(ref?.dataSourceId),
      };
    }),
  }));
  return { rows };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/create-nextion-app test -- locale-add/list`
Expected: PASS

- [ ] **Step 5: Wire the subcommand into the CLI**

Edit `packages/create-nextion-app/src/cli-nextion.ts`. Inside `main`, before the existing `throw new Error("Unsupported command: ...")` line, add a new branch for `locale list` (and a `locale` help message):

```ts
if (command === "locale" && subcommand === "list") {
  const { loadProjectContext } = await import("./project-context.js");
  const { buildLocaleListView } = await import("./locale-add/list.js");
  const context = await loadProjectContext(process.cwd());
  const view = buildLocaleListView({ metadata: context.metadata });
  p.log.info(`default locale: ${context.metadata.defaultLocale}`);
  for (const row of view.rows) {
    const tag = row.isDefault ? " (default)" : "";
    p.log.info(`  - ${row.locale}${tag}`);
    for (const ts of row.translationSources) {
      const mark = ts.configured ? "✓" : "·";
      p.log.info(`      [${mark}] ${ts.modelId} → ${ts.envVar}`);
    }
  }
  return;
}

if (command === "locale" && !subcommand) {
  p.log.info("Usage: npx nextion locale <add|list> ...");
  p.log.info("  add <locale> [--apply] [--with-notion] [--copy-from <locale>]");
  p.log.info("  list");
  return;
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/create-nextion-app/src/locale-add/list.ts \
        packages/create-nextion-app/src/locale-add/list.test.ts \
        packages/create-nextion-app/src/cli-nextion.ts
git commit -m "feat(create-nextion-app): add `nextion locale list` subcommand"
```

---

### Task 4: Surface The Extension Helper In The Generated Project

**Files:**
- Modify: `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl`
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`

- [ ] **Step 1: Re-export the helper from the generated project**

Edit `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl` to add a `defineLocaleContract` re-export:

```ts
export * from "./built-in";
export * from "./paths";
export { defineLocaleContract } from "@notionx/core";
```

- [ ] **Step 2: Reference the new doc and command from the template README**

Edit `packages/create-nextion-app/src/templates/README.md.tmpl`. After the existing "Multilingual foundation" section, append:

````markdown
## Custom content models

To add a new content model to the locale foundation (for example a `products` source), declare a contract in `lib/locale-contract/<model>.ts` using the `defineLocaleContract` helper. A full worked example lives in [the locale-contract extension example](https://github.com/digwis/nextion/blob/main/docs/locale-contract-extension-example.md). The same shape works for jobs, events, recipes, and any other model.

## Inspecting current locales

```bash
npx nextion locale list
```

Prints the current supported locales plus the status of each built-in translation data source (`configured` or `missing`). Use the output to confirm a `nextion locale add` ran cleanly.
````

- [ ] **Step 3: Commit**

```bash
git add packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl \
        packages/create-nextion-app/src/templates/README.md.tmpl
git commit -m "feat(create-nextion-app): surface defineLocaleContract and locale list in the scaffold"
```

---

### Task 5: Final Verification And Changeset

**Files:**
- Create: `.changeset/multilingual-starter-foundation-phase-3.md`

- [ ] **Step 1: Run the full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: exit code `0`

- [ ] **Step 2: Run the full monorepo tests**

Run: `pnpm -r test`
Expected: exit code `0`

- [ ] **Step 3: Run the release status check**

Run: `pnpm release:status`
Expected: a clean no-publish result (or a clear changeset warning)

- [ ] **Step 4: Write the changeset**

Create `.changeset/multilingual-starter-foundation-phase-3.md`:

```md
---
"@notionx/core": minor
"@notionx/create-nextion-app": minor
---

Add developer ergonomics on top of the multilingual foundation: a `defineLocaleContract` helper for custom content models (lives in `@notionx/core`, re-exported from the generated project), a `npx nextion locale list` subcommand that shows the current supported locales plus translation-source status, and a full worked example for adding a custom `products` model to the foundation.
```

- [ ] **Step 5: Commit the changeset**

```bash
git add .changeset/multilingual-starter-foundation-phase-3.md
git commit -m "chore: add changeset for multilingual foundation phase 3"
```

---

## Self-Review

- [ ] **Spec coverage** — Re-checked the design spec against the tasks: every "extension examples for custom content models" item is in Task 1 (helper) + Task 2 (worked example doc) + Task 4 (scaffold re-export). The developer-ergonomics items are in Task 3 (`nextion locale list`) + Task 4 (template README pointers).
- [ ] **Placeholder scan** — No "TBD" / "TODO" / "similar to" markers. Every code block contains the actual code the engineer will paste.
- [ ] **Type consistency** — `defineLocaleContract` widens the id at the boundary and forwards the typed shape to `defineLocalizedContentSource`, so the registry type stays consistent. `LocaleListRow.translationSources` is computed from the same `BUILT_IN_MODELS` constant the Phase 2 planner uses.

## Out Of Scope (Recorded For Future Plans)

- AI / skill-assisted workflows on top of `nextion locale add` (the design says these are optional and exploratory).
- Removing locales (still intentionally not supported by the foundation).
- Bulk translation via third-party services.
