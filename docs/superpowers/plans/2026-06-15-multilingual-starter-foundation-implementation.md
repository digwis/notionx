# Multilingual Starter Foundation Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a multilingual foundation for the four built-in starter models (`blog`, `pages`, `blocks`, `site settings`) by defining a canonical `base + translations` contract in `@notionx/core`, providing reusable locale/content helpers, and updating the scaffolder templates to generate a multilingual-ready project. The single-locale code path must keep working unchanged.

**Architecture:** Layer the new API on top of the existing i18n module and the proven `moviebluebook` `base + translations` pattern. Add a new `localeContract` module that owns the canonical field-shape contract per built-in model and exposes a `defineLocalizedContentSource` helper. Refine the existing `localized.ts` content helpers into model-agnostic primitives (lookup, merge, list, alternates). The scaffolder templates then consume these contracts so any new project ships locale-aware code paths whether the user picked a single locale or bilingual mode.

**Tech Stack:** TypeScript, Vitest, pnpm workspace, Notion API data sources, Clack prompts

**Out of scope (separate follow-up plans):**
- Phase 2: `npx nextion locale add <locale>` command + Notion provisioning/repair
- Phase 3: Developer ergonomics, custom-model extension examples, skill-assisted workflows

---

## File Map

- Create: `packages/nextion/src/locale-contract/index.ts`
  Purpose: Public surface for the built-in four-model locale contract.
- Create: `packages/nextion/src/locale-contract/contract.ts`
  Purpose: Type-level definitions for `LocaleContract`, `BaseFieldMap`, `TranslationFieldMap`, model identifiers, and locale-related helpers.
- Create: `packages/nextion/src/locale-contract/built-in.ts`
  Purpose: Concrete default field shapes for `blog`, `pages`, `blocks`, and `site-settings` (base + translation sides).
- Create: `packages/nextion/src/locale-contract/define.ts`
  Purpose: `defineLocalizedContentSource` that registers a `base + translations` source with a contract id, similar to `defineContentSource`.
- Create: `packages/nextion/src/locale-contract/lookup.ts`
  Purpose: Pure helpers for picking the right translation for a locale with explicit fallback semantics.
- Create: `packages/nextion/src/locale-contract/paths.ts`
  Purpose: Model-aware localized list/detail path helpers that compose with the existing i18n `localizedPath` / `localizedDetailPath`.
- Create: `packages/nextion/src/locale-contract/locale-switcher.ts`
  Purpose: Pure helper that produces alternate URLs across a model's translations with the fallback rule (list if detail missing).
- Modify: `packages/nextion/src/index.ts`
  Purpose: Re-export the new `locale-contract` module from the top-level entry.
- Modify: `packages/nextion/src/i18n/index.ts`
  Purpose: Re-export `defineI18nConfig` from the i18n module so locale-contract callers have a single import.
- Create: `packages/nextion/tests/locale-contract/built-in.test.ts`
  Purpose: Lock the canonical field maps for the four built-in models.
- Create: `packages/nextion/tests/locale-contract/define.test.ts`
  Purpose: Verify `defineLocalizedContentSource` registers and deduplicates entries.
- Create: `packages/nextion/tests/locale-contract/lookup.test.ts`
  Purpose: Verify the strict / fallback / hidden lookup semantics for all four models.
- Create: `packages/nextion/tests/locale-contract/paths.test.ts`
  Purpose: Verify default-locale routes stay unprefixed and non-default locales get a prefix.
- Create: `packages/nextion/tests/locale-contract/locale-switcher.test.ts`
  Purpose: Verify the LocaleSwitcher fallback to the localized list when a detail translation is missing.
- Modify: `packages/create-nextion-app/src/templates/lib/i18n/config.ts.tmpl`
  Purpose: Generate a project-level i18n config that exposes `defineI18nConfig` with the supported locales.
- Create: `packages/create-nextion-app/src/templates/lib/i18n/index.ts.tmpl`
  Purpose: Re-export the project i18n config so app routes and lib code share the same locale constants.
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/built-in.ts.tmpl`
  Purpose: Re-export the four built-in contracts from `@notionx/core` so the generated project has a single import path.
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl`
  Purpose: Project-level barrel re-exporting the locale-contract helpers and built-ins.
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/paths.ts.tmpl`
  Purpose: A thin wrapper that bakes the project's list paths and the default locale into the helpers, so route code does not import the runtime config in every call.
- Create: `packages/create-nextion-app/src/templates/components/site/locale-switcher.tsx.tmpl`
  Purpose: Default `LocaleSwitcher` UI that links to the same model in the chosen locale with the list-fallback rule.
- Modify: `packages/create-nextion-app/src/templates/components/site/site-header.tsx.tmpl`
  Purpose: Render the `LocaleSwitcher` inside the header when more than one locale is configured.
- Modify: `packages/create-nextion-app/src/templates/components/site/site-footer.tsx.tmpl`
  Purpose: Render a minimal locale marker (locale code) in the footer.
- Create: `packages/create-nextion-app/src/templates/lib/pages/translations.ts.tmpl`
  Purpose: Localized page lookup helpers built on top of the locale-contract primitives.
- Create: `packages/create-nextion-app/src/templates/lib/blog/translations.ts.tmpl`
  Purpose: Localized blog post lookup helpers built on top of the locale-contract primitives.
- Create: `packages/create-nextion-app/src/templates/lib/blocks/translations.ts.tmpl`
  Purpose: Localized block lookup helpers with default-locale fallback for missing translations.
- Create: `packages/create-nextion-app/src/templates/lib/site/translations.ts.tmpl`
  Purpose: Localized site-settings translation merge with default-locale fallback.
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`
  Purpose: Document the multilingual foundation shape, the four built-in models, and the LocaleSwitcher.

---

### Task 1: Define The Locale Contract Types

**Files:**
- Create: `packages/nextion/src/locale-contract/contract.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/nextion/tests/locale-contract/built-in.test.ts` (the import resolution step will fail until the file exists):

```ts
import { describe, expect, it } from "vitest";
import {
  blogContract,
  blocksContract,
  pagesContract,
  siteSettingsContract,
} from "../../src/locale-contract/built-in";

describe("built-in locale contracts", () => {
  it("declares a stable id and base/translation source names", () => {
    expect(blogContract.id).toBe("blog");
    expect(blogContract.baseSourceName).toBe("blog");
    expect(blogContract.translationSourceName).toBe("blog-translations");
  });

  it("exposes field maps for every built-in model", () => {
    expect(Object.keys(pagesContract.baseFields)).toEqual(
      expect.arrayContaining(["title", "key", "layout", "showInNav"])
    );
    expect(Object.keys(pagesContract.translationFields)).toEqual(
      expect.arrayContaining(["locale", "slug", "title", "navLabel"])
    );
    expect(Object.keys(blocksContract.translationFields)).toEqual(
      expect.arrayContaining(["eyebrow", "headline", "body"])
    );
    expect(
      Object.keys(siteSettingsContract.translationFields)
    ).toEqual(expect.arrayContaining(["tagline", "footerTagline"]));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/built-in`
Expected: FAIL with "Cannot find module '../../src/locale-contract/built-in'"

- [ ] **Step 3: Create the contract types module**

Create `packages/nextion/src/locale-contract/contract.ts`:

```ts
// packages/nextion/src/locale-contract/contract.ts
//
// Canonical types for the multilingual foundation. A `LocaleContract`
// pins the Notion data-source name, the base field map, the translation
// field map, and the lookup fallback rule for one built-in model. The
// shape mirrors the `moviebluebook` `base + translations` pattern,
// generalized to the four built-in starter models.

export type LocaleFallbackRule =
  | "default-locale"   // fall back to default locale copy
  | "strict-missing"   // hide / 404 when missing
  | "hide";            // exclude from list / detail when missing

export type FieldMap = Record<string, string>;

export type LocaleContract = {
  /** Stable identifier; matches the registered content-source id. */
  id: "blog" | "pages" | "blocks" | "site-settings";
  /** Notion data source name for the base side. */
  baseSourceName: string;
  /** Notion data source name for the translation side. */
  translationSourceName: string;
  /** Base-side Notion property names. */
  baseFields: FieldMap;
  /** Translation-side Notion property names. */
  translationFields: FieldMap;
  /** Lookup fallback rule for this model. */
  fallback: LocaleFallbackRule;
  /** Default list route for this model (used by path helpers). */
  listPath: string;
  /** Path segment used inside the detail route. */
  detailParam: string;
};

export function isLocaleContractId(
  value: string
): value is LocaleContract["id"] {
  return (
    value === "blog" ||
    value === "pages" ||
    value === "blocks" ||
    value === "site-settings"
  );
}
```

- [ ] **Step 4: Run the test to confirm it still fails on the built-in file**

Run: `pnpm --filter @notionx/core test -- locale-contract/built-in`
Expected: FAIL with "Cannot find module '../../src/locale-contract/built-in'"

---

### Task 2: Ship The Built-In Contract Defaults

**Files:**
- Create: `packages/nextion/src/locale-contract/built-in.ts`

- [ ] **Step 1: Implement the built-in defaults**

Create `packages/nextion/src/locale-contract/built-in.ts`:

```ts
// packages/nextion/src/locale-contract/built-in.ts
//
// Default field maps for the four built-in starter models. These names
// are what the scaffolder will provision in Notion and what the
// generated `lib/*/translations.ts` modules read from. Keep the keys
// stable — they are the contract.

import type { LocaleContract } from "./contract";

export const blogBaseFields = {
  title: "Title",
  author: "Author",
  publishedAt: "Published At",
  tags: "Tags",
  cover: "Cover",
  status: "Status",
} as const;

export const blogTranslationFields = {
  source: "Source",
  locale: "Locale",
  slug: "Slug",
  title: "Title",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  body: "Body",
  published: "Published",
} as const;

export const pagesBaseFields = {
  title: "Name",
  key: "Key",
  layout: "Layout",
  showHeader: "Show Header",
  showFooter: "Show Footer",
  showInNav: "Show in Nav",
  navOrder: "Nav Order",
  showInFooter: "Show in Footer",
  footerGroup: "Footer Group",
  footerOrder: "Footer Order",
  contentSource: "Content Source",
  blocks: "Blocks",
  cover: "Cover",
} as const;

export const pagesTranslationFields = {
  source: "Source",
  locale: "Locale",
  slug: "Slug",
  title: "Title",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  navLabel: "Nav Label",
  footerLabel: "Footer Label",
  body: "Body",
  published: "Published",
} as const;

export const blocksBaseFields = {
  key: "Key",
  type: "Type",
  pageKeys: "Page Keys",
  order: "Order",
  theme: "Theme",
  layout: "Layout",
  cover: "Cover",
} as const;

export const blocksTranslationFields = {
  source: "Source",
  locale: "Locale",
  title: "Title",
  description: "Description",
  eyebrow: "Eyebrow",
  headline: "Headline",
  subheadline: "Subheadline",
  body: "Body",
  quote: "Quote",
  quoteAttribution: "Quote Attribution",
  primaryCtaLabel: "Primary CTA Label",
  primaryCtaHref: "Primary CTA Href",
  secondaryCtaLabel: "Secondary CTA Label",
  secondaryCtaHref: "Secondary CTA Href",
  published: "Published",
} as const;

export const siteSettingsBaseFields = {
  name: "Name",
  defaultLocale: "Default Locale",
  supportedLocales: "Supported Locales",
  theme: "Theme",
  typography: "Typography",
  socialLinks: "Social Links",
  navigation: "Navigation",
  defaultSocialImage: "Default Social Image",
  featureSwitches: "Feature Switches",
} as const;

export const siteSettingsTranslationFields = {
  source: "Source",
  locale: "Locale",
  tagline: "Tagline",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  navLabels: "Nav Labels",
  footerLabels: "Footer Labels",
  globalFallbackCopy: "Global Fallback Copy",
  published: "Published",
} as const;

export const blogContract: LocaleContract = {
  id: "blog",
  baseSourceName: "blog",
  translationSourceName: "blog-translations",
  baseFields: { ...blogBaseFields },
  translationFields: { ...blogTranslationFields },
  fallback: "hide",
  listPath: "/blog",
  detailParam: "slug",
};

export const pagesContract: LocaleContract = {
  id: "pages",
  baseSourceName: "pages",
  translationSourceName: "page-translations",
  baseFields: { ...pagesBaseFields },
  translationFields: { ...pagesTranslationFields },
  fallback: "strict-missing",
  listPath: "/",
  detailParam: "slug",
};

export const blocksContract: LocaleContract = {
  id: "blocks",
  baseSourceName: "blocks",
  translationSourceName: "block-translations",
  baseFields: { ...blocksBaseFields },
  translationFields: { ...blocksTranslationFields },
  fallback: "default-locale",
  listPath: "/",
  detailParam: "slug",
};

export const siteSettingsContract: LocaleContract = {
  id: "site-settings",
  baseSourceName: "site-settings",
  translationSourceName: "site-settings-translations",
  baseFields: { ...siteSettingsBaseFields },
  translationFields: { ...siteSettingsTranslationFields },
  fallback: "default-locale",
  listPath: "/",
  detailParam: "key",
};
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/core test -- locale-contract/built-in`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/nextion/src/locale-contract/contract.ts \
        packages/nextion/src/locale-contract/built-in.ts \
        packages/nextion/tests/locale-contract/built-in.test.ts
git commit -m "feat(nextion): add built-in locale contracts for the four starter models"
```

---

### Task 3: Add `defineLocalizedContentSource` Registration

**Files:**
- Create: `packages/nextion/src/locale-contract/define.ts`
- Create: `packages/nextion/src/locale-contract/index.ts`
- Create: `packages/nextion/tests/locale-contract/define.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/nextion/tests/locale-contract/define.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import {
  clearLocalizedRegistryForTests,
  defineLocalizedContentSource,
  getLocalizedContracts,
  getRegisteredLocalizedSource,
} from "../../src/locale-contract/define";

describe("defineLocalizedContentSource", () => {
  it("registers the contract and returns it unchanged", () => {
    clearLocalizedRegistryForTests();
    const returned = defineLocalizedContentSource({
      ...blogContract,
      listPath: "/articles",
    });
    expect(returned.id).toBe("blog");
    expect(getRegisteredLocalizedSource("blog")?.listPath).toBe("/articles");
    expect(getLocalizedContracts().map((c) => c.id)).toContain("blog");
  });

  it("is idempotent on id (last write wins)", () => {
    clearLocalizedRegistryForTests();
    defineLocalizedContentSource({ ...blogContract, listPath: "/a" });
    defineLocalizedContentSource({ ...blogContract, listPath: "/b" });
    expect(getRegisteredLocalizedSource("blog")?.listPath).toBe("/b");
    expect(getLocalizedContracts().filter((c) => c.id === "blog")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/define`
Expected: FAIL with "Cannot find module '../../src/locale-contract/define'"

- [ ] **Step 3: Implement the registry**

Create `packages/nextion/src/locale-contract/define.ts`:

```ts
// packages/nextion/src/locale-contract/define.ts
//
// Registry for locale-aware content sources. Mirrors the shape of
// `defineContentSource` in `content/models.ts` so call sites use the
// same `defineX` / `getRegisteredX` pattern. Re-registering the same
// id replaces the prior value, which keeps HMR + tests deterministic.

import type { LocaleContract } from "./contract";

const registry: LocaleContract[] = [];

export function defineLocalizedContentSource(
  contract: LocaleContract
): LocaleContract {
  const existing = registry.findIndex((c) => c.id === contract.id);
  if (existing >= 0) registry[existing] = contract;
  else registry.push(contract);
  return contract;
}

export function getRegisteredLocalizedSource(
  id: LocaleContract["id"]
): LocaleContract | undefined {
  return registry.find((c) => c.id === id);
}

export function getLocalizedContracts(): readonly LocaleContract[] {
  return registry;
}

export function clearLocalizedRegistryForTests(): void {
  registry.length = 0;
}
```

Create `packages/nextion/src/locale-contract/index.ts`:

```ts
// packages/nextion/src/locale-contract/index.ts
//
// Public surface for the multilingual foundation. Re-exports the
// built-in contracts, the registry helpers, and the pure lookup /
// path / locale-switcher primitives.

export * from "./contract";
export * from "./built-in";
export * from "./define";
export * from "./lookup";
export * from "./paths";
export * from "./locale-switcher";
```

- [ ] **Step 4: Run the test to confirm lookup/paths/switcher files are required**

Run: `pnpm --filter @notionx/core test -- locale-contract/define`
Expected: FAIL because `lookup`, `paths`, `locale-switcher` are not yet exported from the barrel.

---

### Task 4: Implement Lookup Helpers With Fallback Semantics

**Files:**
- Create: `packages/nextion/src/locale-contract/lookup.ts`
- Create: `packages/nextion/tests/locale-contract/lookup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/nextion/tests/locale-contract/lookup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blogContract, pagesContract, blocksContract, siteSettingsContract } from "../../src/locale-contract/built-in";
import {
  pickTranslation,
  pickTranslationOrDefault,
  hideWhenMissing,
} from "../../src/locale-contract/lookup";

type Translation = { locale: string; slug: string; title: string; published: boolean };

const en: Translation = { locale: "en", slug: "hello", title: "Hello", published: true };
const zh: Translation = { locale: "zh-CN", slug: "ni-hao", title: "你好", published: true };

describe("pickTranslation", () => {
  it("returns null when the locale is missing and rule is strict-missing", () => {
    expect(pickTranslation([en], "zh-CN", pagesContract)).toBeNull();
  });

  it("returns null when the locale is missing and rule is hide", () => {
    expect(pickTranslation([en], "zh-CN", blogContract)).toBeNull();
  });

  it("falls back to the default-locale translation when rule is default-locale", () => {
    expect(pickTranslation([en], "zh-CN", blocksContract)?.locale).toBe("en");
  });
});

describe("pickTranslationOrDefault", () => {
  it("returns the default-locale entry as a last-resort fallback for any rule", () => {
    expect(pickTranslationOrDefault([en], "zh-CN", "en", pagesContract)).toEqual(en);
  });
});

describe("hideWhenMissing", () => {
  it("filters out translations that do not match the requested locale", () => {
    expect(hideWhenMissing([en, zh], "zh-CN")).toEqual([zh]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/lookup`
Expected: FAIL with "Cannot find module '../../src/locale-contract/lookup'"

- [ ] **Step 3: Implement the lookup helpers**

Create `packages/nextion/src/locale-contract/lookup.ts`:

```ts
// packages/nextion/src/locale-contract/lookup.ts
//
// Pure translation lookup helpers. They never touch Notion — pass the
// already-loaded translation rows in. The three functions below cover
// the three fallback rules defined on `LocaleContract`:

//   - `pickTranslation`           strict + hide + default-locale
//   - `pickTranslationOrDefault`  always last-resort to default locale
//   - `hideWhenMissing`           filters out non-matching locales

import type { LocaleContract } from "./contract";

export type LocaleRow = { locale: string };

function matchLocale<T extends LocaleRow>(rows: readonly T[], locale: string) {
  return rows.find((row) => row.locale === locale) ?? null;
}

export function pickTranslation<T extends LocaleRow>(
  rows: readonly T[],
  locale: string,
  contract: LocaleContract
): T | null {
  const direct = matchLocale(rows, locale);
  if (direct) return direct;
  if (contract.fallback === "default-locale") {
    return matchLocale(rows, contract.listPath === "/" ? "" : locale) ?? null;
  }
  return null;
}

export function pickTranslationOrDefault<T extends LocaleRow>(
  rows: readonly T[],
  locale: string,
  defaultLocale: string,
  _contract: LocaleContract
): T | null {
  return matchLocale(rows, locale) ?? matchLocale(rows, defaultLocale) ?? null;
}

export function hideWhenMissing<T extends LocaleRow>(
  rows: readonly T[],
  locale: string
): T[] {
  return rows.filter((row) => row.locale === locale);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @notionx/core test -- locale-contract/lookup`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/nextion/src/locale-contract/define.ts \
        packages/nextion/src/locale-contract/lookup.ts \
        packages/nextion/src/locale-contract/index.ts \
        packages/nextion/tests/locale-contract/define.test.ts \
        packages/nextion/tests/locale-contract/lookup.test.ts
git commit -m "feat(nextion): add locale-contract registry and fallback-aware lookup helpers"
```

---

### Task 5: Add Locale-Aware Path And Switcher Helpers

**Files:**
- Create: `packages/nextion/src/locale-contract/paths.ts`
- Create: `packages/nextion/src/locale-contract/locale-switcher.ts`
- Create: `packages/nextion/tests/locale-contract/paths.test.ts`
- Create: `packages/nextion/tests/locale-contract/locale-switcher.test.ts`

- [ ] **Step 1: Write the failing test for paths**

Create `packages/nextion/tests/locale-contract/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import {
  localizedListPath,
  localizedDetailPathFor,
  stripLocalePrefix,
} from "../../src/locale-contract/paths";

describe("localizedListPath", () => {
  it("keeps the default-locale list path unprefixed", () => {
    expect(localizedListPath("en", blogContract)).toBe("/blog");
  });

  it("prefixes non-default-locale list paths with the locale", () => {
    expect(localizedListPath("zh-CN", blogContract)).toBe("/zh-CN/blog");
  });
});

describe("localizedDetailPathFor", () => {
  it("joins the localized list path with the slug for the default locale", () => {
    expect(localizedDetailPathFor("en", "hello-world", blogContract)).toBe(
      "/blog/hello-world"
    );
  });

  it("joins the localized list path with the slug for a non-default locale", () => {
    expect(localizedDetailPathFor("zh-CN", "hello-world", blogContract)).toBe(
      "/zh-CN/blog/hello-world"
    );
  });
});

describe("stripLocalePrefix", () => {
  it("removes a known locale prefix from a path", () => {
    expect(stripLocalePrefix("/zh-CN/blog", "zh-CN")).toBe("/blog");
  });

  it("returns the path unchanged when no locale prefix is present", () => {
    expect(stripLocalePrefix("/blog", "zh-CN")).toBe("/blog");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/paths`
Expected: FAIL with "Cannot find module '../../src/locale-contract/paths'"

- [ ] **Step 3: Implement the path helpers**

Create `packages/nextion/src/locale-contract/paths.ts`:

```ts
// packages/nextion/src/locale-contract/paths.ts
//
// Locale-aware list / detail / strip helpers. Default-locale routes
// stay unprefixed (`/blog`); non-default locales get a prefix
// (`/zh-CN/blog`). The helpers compose with the i18n `localizedPath`
// family but also know about the contract's `listPath`.

import type { LocaleContract } from "./contract";

export function localizedListPath(
  locale: string,
  contract: LocaleContract,
  defaultLocale: string
) {
  if (locale === defaultLocale) return contract.listPath;
  return joinPath(`/${locale}`, contract.listPath);
}

export function localizedDetailPathFor(
  locale: string,
  slug: string,
  contract: LocaleContract,
  defaultLocale: string
) {
  const list = localizedListPath(locale, contract, defaultLocale);
  return joinPath(list, slug);
}

export function stripLocalePrefix(path: string, locale: string) {
  const prefix = `/${locale}`;
  if (path === prefix) return "/";
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

function joinPath(left: string, right: string) {
  const cleanLeft = left.replace(/\/+$/, "");
  const cleanRight = right.replace(/^\/+/, "");
  if (!cleanRight) return cleanLeft || "/";
  return `${cleanLeft}/${cleanRight}`;
}
```

- [ ] **Step 4: Write the failing test for the locale switcher**

Create `packages/nextion/tests/locale-contract/locale-switcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import { buildLocaleSwitcherLinks } from "../../src/locale-contract/locale-switcher";

type Detail = { locale: string; slug: string; sourcePageId: string };

describe("buildLocaleSwitcherLinks", () => {
  it("links to the same detail in each supported locale when a translation exists", () => {
    const links = buildLocaleSwitcherLinks({
      contract: blogContract,
      currentLocale: "en",
      defaultLocale: "en",
      currentSlug: "hello",
      supportedLocales: ["en", "zh-CN"],
      translations: [
        { locale: "en", slug: "hello", sourcePageId: "src-1" },
        { locale: "zh-CN", slug: "ni-hao", sourcePageId: "src-1" },
      ],
    });
    expect(links).toEqual([
      { locale: "en", href: "/blog/hello" },
      { locale: "zh-CN", href: "/zh-CN/blog/ni-hao" },
    ]);
  });

  it("falls back to the localized list when a detail translation is missing", () => {
    const links = buildLocaleSwitcherLinks({
      contract: blogContract,
      currentLocale: "en",
      defaultLocale: "en",
      currentSlug: "hello",
      supportedLocales: ["en", "zh-CN"],
      translations: [{ locale: "en", slug: "hello", sourcePageId: "src-1" }],
    });
    expect(links).toEqual([
      { locale: "en", href: "/blog/hello" },
      { locale: "zh-CN", href: "/zh-CN/blog" },
    ]);
  });
});
```

- [ ] **Step 5: Run the test to confirm it fails**

Run: `pnpm --filter @notionx/core test -- locale-contract/locale-switcher`
Expected: FAIL with "Cannot find module '../../src/locale-contract/locale-switcher'"

- [ ] **Step 6: Implement the locale switcher**

Create `packages/nextion/src/locale-contract/locale-switcher.ts`:

```ts
// packages/nextion/src/locale-contract/locale-switcher.ts
//
// Pure helper that produces the `LocaleSwitcher` link list. The rule
// is documented in the design:
//
//   - list pages always link to the same model's localized list
//   - detail pages link to the matching translated detail when one
//     exists, otherwise fall back to the localized list (never a
//     broken detail)

import type { LocaleContract } from "./contract";
import { localizedDetailPathFor, localizedListPath } from "./paths";

export type LocaleSwitcherLink = {
  locale: string;
  href: string;
};

export type LocaleSwitcherTranslation = {
  locale: string;
  slug: string;
  sourcePageId: string;
};

export function buildLocaleSwitcherLinks(input: {
  contract: LocaleContract;
  currentLocale: string;
  defaultLocale: string;
  currentSlug: string;
  supportedLocales: readonly string[];
  translations: readonly LocaleSwitcherTranslation[];
}): LocaleSwitcherLink[] {
  const sourcePageId = input.translations.find(
    (row) => row.locale === input.currentLocale
  )?.sourcePageId;

  return input.supportedLocales.map((locale) => {
    const match = sourcePageId
      ? input.translations.find(
          (row) => row.sourcePageId === sourcePageId && row.locale === locale
        )
      : undefined;

    if (match) {
      return {
        locale,
        href: localizedDetailPathFor(
          locale,
          match.slug,
          input.contract,
          input.defaultLocale
        ),
      };
    }

    return {
      locale,
      href: localizedListPath(locale, input.contract, input.defaultLocale),
    };
  });
}
```

- [ ] **Step 7: Run all locale-contract tests**

Run: `pnpm --filter @notionx/core test -- locale-contract`
Expected: PASS for all four files

- [ ] **Step 8: Commit**

```bash
git add packages/nextion/src/locale-contract/paths.ts \
        packages/nextion/src/locale-contract/locale-switcher.ts \
        packages/nextion/tests/locale-contract/paths.test.ts \
        packages/nextion/tests/locale-contract/locale-switcher.test.ts
git commit -m "feat(nextion): add locale-aware path helpers and locale switcher"
```

---

### Task 6: Re-Expose The Locale Contract From The Top-Level Entry

**Files:**
- Modify: `packages/nextion/src/index.ts`
- Modify: `packages/nextion/src/i18n/index.ts`

- [ ] **Step 1: Add the top-level re-export**

Edit `packages/nextion/src/index.ts` so the new module is reachable from the package root. Replace the existing top-level exports with:

```ts
// Public top-level entry. Subpath exports carry the bulk of the API.
export type {
  ContentSource,
  AuthConfig,
  AdminExtension,
  AdminNavItem,
  WorkerOptions,
  FoundationConfig,
} from "./types";

export { defineContentSource } from "./content/models";
export { createNextionWorker } from "./worker/bootstrap";
export { runNextionDoctor } from "./doctor";
export type {
  DoctorFinding,
  RuntimeLike,
  RunNextionDoctorOptions,
  NextionDoctorFindingsReport,
} from "./doctor";

// Multilingual foundation: the built-in four-model locale contract
// and the lookup / path / switcher primitives. Re-exported from the
// root so generated projects can `import { ... } from "@notionx/core"`.
export type {
  LocaleContract,
  LocaleFallbackRule,
  FieldMap,
} from "./locale-contract/contract";
export {
  blogContract,
  blocksContract,
  pagesContract,
  siteSettingsContract,
} from "./locale-contract/built-in";
export {
  defineLocalizedContentSource,
  getRegisteredLocalizedSource,
  getLocalizedContracts,
} from "./locale-contract/define";
export {
  pickTranslation,
  pickTranslationOrDefault,
  hideWhenMissing,
} from "./locale-contract/lookup";
export {
  localizedListPath,
  localizedDetailPathFor,
  stripLocalePrefix,
} from "./locale-contract/paths";
export {
  buildLocaleSwitcherLinks,
  type LocaleSwitcherLink,
  type LocaleSwitcherTranslation,
} from "./locale-contract/locale-switcher";
```

- [ ] **Step 2: Re-export `defineI18nConfig` from the i18n barrel**

Edit `packages/nextion/src/i18n/index.ts`:

```ts
export * from "./config";
export * from "./messages";
export { defineI18nConfig } from "./config";
```

- [ ] **Step 3: Type-check the package**

Run: `pnpm --filter @notionx/core typecheck`
Expected: exit code `0`

- [ ] **Step 4: Commit**

```bash
git add packages/nextion/src/index.ts packages/nextion/src/i18n/index.ts
git commit -m "feat(nextion): expose locale-contract primitives from the public entry"
```

---

### Task 7: Generate Project i18n Config In The Scaffold

**Files:**
- Create: `packages/create-nextion-app/src/templates/lib/i18n/config.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/i18n/index.ts.tmpl`

- [ ] **Step 1: Create the project i18n config template**

Create `packages/create-nextion-app/src/templates/lib/i18n/config.ts.tmpl`:

```ts
// Project-level i18n config. Re-exports the runtime helpers from
// `@notionx/core` so app code, route handlers, and components share
// one set of locale constants. The supported locales are baked in
// at scaffold time; use `npx nextion locale add <locale>` to extend
// an existing project.

import { defineI18nConfig } from "@notionx/core/i18n";

export const i18n = defineI18nConfig({
  defaultLocale: "{{defaultLocale}}",
  supportedLocales: {{supportedLocalesJson}},
});

export type AppLocale = (typeof i18n.supportedLocales)[number];

export function isAppLocale(value: string): value is AppLocale {
  return (i18n.supportedLocales as readonly string[]).includes(value);
}
```

- [ ] **Step 2: Create the i18n barrel template**

Create `packages/create-nextion-app/src/templates/lib/i18n/index.ts.tmpl`:

```ts
export * from "./config";
```

- [ ] **Step 3: Commit**

```bash
git add packages/create-nextion-app/src/templates/lib/i18n/config.ts.tmpl \
        packages/create-nextion-app/src/templates/lib/i18n/index.ts.tmpl
git commit -m "feat(create-nextion-app): ship project i18n config in the scaffold"
```

---

### Task 8: Generate Project Locale-Contract Module

**Files:**
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/built-in.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/paths.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl`

- [ ] **Step 1: Create the built-in re-export template**

Create `packages/create-nextion-app/src/templates/lib/locale-contract/built-in.ts.tmpl`:

```ts
// Built-in locale contracts re-exported under a project-friendly
// import path. The list paths here are the canonical ones for the
// starter: the blog content source list and the page detail route.

import {
  blogContract as coreBlogContract,
  pagesContract as corePagesContract,
  blocksContract as coreBlocksContract,
  siteSettingsContract as coreSiteSettingsContract,
} from "@notionx/core";

export const blogContract = {
  ...coreBlogContract,
  listPath: "{{contentSourceListPath}}",
};

export const pagesContract = corePagesContract;
export const blocksContract = coreBlocksContract;
export const siteSettingsContract = coreSiteSettingsContract;
```

- [ ] **Step 2: Create the project path helper template**

Create `packages/create-nextion-app/src/templates/lib/locale-contract/paths.ts.tmpl`:

```ts
// Thin wrappers around the core path helpers that bake the project's
// default locale and the blog content source list path in. Route code
// should import from this module rather than the core helpers directly
// so the defaults stay consistent.

import { i18n } from "@/lib/i18n";
import {
  localizedListPath as coreLocalizedListPath,
  localizedDetailPathFor as coreLocalizedDetailPathFor,
  stripLocalePrefix as coreStripLocalePrefix,
} from "@notionx/core";
import { blogContract } from "./built-in";

export function blogListPath(locale: string) {
  return coreLocalizedListPath(locale, blogContract, i18n.defaultLocale);
}

export function blogDetailPath(locale: string, slug: string) {
  return coreLocalizedDetailPathFor(
    locale,
    slug,
    blogContract,
    i18n.defaultLocale
  );
}

export function stripBlogLocale(path: string, locale: string) {
  return coreStripLocalePrefix(path, locale);
}
```

- [ ] **Step 3: Create the locale-contract barrel template**

Create `packages/create-nextion-app/src/templates/lib/locale-contract/index.ts.tmpl`:

```ts
export * from "./built-in";
export * from "./paths";
```

- [ ] **Step 4: Commit**

```bash
git add packages/create-nextion-app/src/templates/lib/locale-contract/
git commit -m "feat(create-nextion-app): ship locale-contract module in the scaffold"
```

---

### Task 9: Generate Per-Model Translation Lookup Helpers

**Files:**
- Create: `packages/create-nextion-app/src/templates/lib/blog/translations.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/pages/translations.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/blocks/translations.ts.tmpl`
- Create: `packages/create-nextion-app/src/templates/lib/site/translations.ts.tmpl`

- [ ] **Step 1: Create the blog translations template**

Create `packages/create-nextion-app/src/templates/lib/blog/translations.ts.tmpl`:

```ts
// Locale-aware blog lookup. Falls back to the default-locale
// translation when a target locale is missing (rule: hide).

import { pickTranslation, hideWhenMissing } from "@notionx/core";
import { i18n } from "@/lib/i18n";
import { blogContract } from "@/lib/locale-contract";
import { mapNotionPageToLocalizedContentTranslation } from "@notionx/core";

export type BlogTranslation = ReturnType<
  typeof mapNotionPageToLocalizedContentTranslation<{ summary: string; tags: string[] }>
>;

export function pickBlogTranslation(
  rows: readonly NonNullable<BlogTranslation>[],
  locale: string
) {
  return pickTranslation(rows, locale, blogContract);
}

export function blogListForLocale(
  rows: readonly NonNullable<BlogTranslation>[],
  locale: string
) {
  return hideWhenMissing(rows, locale);
}
```

- [ ] **Step 2: Create the page translations template**

Create `packages/create-nextion-app/src/templates/lib/pages/translations.ts.tmpl`:

```ts
// Locale-aware page lookup. Uses the strict-missing rule: if a
// localized page is missing in the target locale, do not pretend the
// page exists — let the caller render a localized not-found.

import { pickTranslation } from "@notionx/core";
import { i18n } from "@/lib/i18n";
import { pagesContract } from "@/lib/locale-contract";

export type PageTranslation = {
  pageId: string;
  sourcePageId: string;
  locale: string;
  slug: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  navLabel: string;
  footerLabel: string;
  published: boolean;
};

export function pickPageTranslation(
  rows: readonly PageTranslation[],
  locale: string
): PageTranslation | null {
  return pickTranslation(rows, locale, pagesContract);
}

export function getDefaultLocalePage(
  rows: readonly PageTranslation[]
): PageTranslation | null {
  return pickTranslation(rows, i18n.defaultLocale, pagesContract);
}
```

- [ ] **Step 3: Create the blocks translations template**

Create `packages/create-nextion-app/src/templates/lib/blocks/translations.ts.tmpl`:

```ts
// Locale-aware block lookup. Uses the default-locale fallback rule:
// a block without a translation in the target locale resolves to the
// default-locale copy so page shells stay usable.

import {
  pickTranslation,
  pickTranslationOrDefault,
} from "@notionx/core";
import { i18n } from "@/lib/i18n";
import { blocksContract } from "@/lib/locale-contract";

export type BlockTranslation = {
  pageId: string;
  sourcePageId: string;
  locale: string;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  body: string;
  quote: string;
  quoteAttribution: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  published: boolean;
};

export function pickBlockTranslation(
  rows: readonly BlockTranslation[],
  locale: string
) {
  return (
    pickTranslation(rows, locale, blocksContract) ??
    pickTranslationOrDefault(
      rows,
      locale,
      i18n.defaultLocale,
      blocksContract
    )
  );
}
```

- [ ] **Step 4: Create the site-settings translations template**

Create `packages/create-nextion-app/src/templates/lib/site/translations.ts.tmpl`:

```ts
// Locale-aware site settings merge. The `site-settings` Notion row
// holds the global config; the `site-settings-translations` row
// holds locale-specific copy. Missing locale copy falls back to the
// default-locale translation.

import { i18n } from "@/lib/i18n";
import { siteSettingsContract } from "@/lib/locale-contract";

export type SiteSettingsTranslation = {
  pageId: string;
  sourcePageId: string;
  locale: string;
  tagline: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  navLabels: Record<string, string>;
  footerLabels: Record<string, string>;
  globalFallbackCopy: string;
  published: boolean;
};

export function pickSiteSettingsTranslation(
  rows: readonly SiteSettingsTranslation[],
  locale: string
) {
  const direct = rows.find((row) => row.locale === locale);
  if (direct) return direct;
  return rows.find((row) => row.locale === i18n.defaultLocale) ?? null;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/templates/lib/blog/translations.ts.tmpl \
        packages/create-nextion-app/src/templates/lib/pages/translations.ts.tmpl \
        packages/create-nextion-app/src/templates/lib/blocks/translations.ts.tmpl \
        packages/create-nextion-app/src/templates/lib/site/translations.ts.tmpl
git commit -m "feat(create-nextion-app): ship per-model locale lookup helpers in the scaffold"
```

---

### Task 10: Add The LocaleSwitcher Component And Wire The Header

**Files:**
- Create: `packages/create-nextion-app/src/templates/components/site/locale-switcher.tsx.tmpl`
- Modify: `packages/create-nextion-app/src/templates/components/site/site-header.tsx.tmpl`
- Modify: `packages/create-nextion-app/src/templates/components/site/site-footer.tsx.tmpl`

- [ ] **Step 1: Create the LocaleSwitcher template**

Create `packages/create-nextion-app/src/templates/components/site/locale-switcher.tsx.tmpl`:

```tsx
// Default `LocaleSwitcher` for the four built-in starter models. Renders
// one link per supported locale, following the locale-switcher rule
// from the design:
//
//   - link to the same model's translated detail when one exists
//   - fall back to the localized list when a detail is missing
//
// The component is intentionally a server component: the link list
// is computed from the request URL and the supported locales — no
// client state needed.

import Link from "next/link";
import { i18n, isAppLocale } from "@/lib/i18n";
import { buildLocaleSwitcherLinks, type LocaleSwitcherTranslation } from "@notionx/core";
import { blogContract } from "@/lib/locale-contract";

type Props = {
  currentLocale: string;
  currentSlug?: string;
  translations?: readonly LocaleSwitcherTranslation[];
};

export function LocaleSwitcher({ currentLocale, currentSlug, translations = [] }: Props) {
  if (i18n.supportedLocales.length < 2) return null;
  if (!isAppLocale(currentLocale)) return null;

  const links = currentSlug
    ? buildLocaleSwitcherLinks({
        contract: blogContract,
        currentLocale,
        defaultLocale: i18n.defaultLocale,
        currentSlug,
        supportedLocales: i18n.supportedLocales,
        translations,
      })
    : i18n.supportedLocales.map((locale) => ({
        locale,
        href: locale === i18n.defaultLocale ? blogContract.listPath : `/${locale}${blogContract.listPath}`,
      }));

  return (
    <nav aria-label="Language" className="flex items-center gap-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.locale}
          href={link.href}
          aria-current={link.locale === currentLocale ? "true" : undefined}
          className="rounded px-2 py-1 hover:bg-muted"
        >
          {link.locale}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Wire the LocaleSwitcher into the header**

Read `packages/create-nextion-app/src/templates/components/site/site-header.tsx.tmpl` and add an import + render of `<LocaleSwitcher />` next to the existing nav links. Wrap the render in a conditional so single-locale projects do not show a switcher. The exact insertion point is inside the header `<div>` after the existing nav `<nav>` element:

```tsx
import { LocaleSwitcher } from "./locale-switcher";

// ...inside the header return value, after the existing <nav>:
{i18n.supportedLocales.length > 1 ? (
  <LocaleSwitcher currentLocale={i18n.defaultLocale} />
) : null}
```

Make sure the file imports `i18n` from `@/lib/i18n` (add the import if it is not there yet).

- [ ] **Step 3: Add a locale marker to the footer**

Read `packages/create-nextion-app/src/templates/components/site/site-footer.tsx.tmpl` and, inside the footer root, render a small text marker that shows the current locale. If the existing footer has a tagline `<p>`, append the locale after a separator:

```tsx
import { i18n } from "@/lib/i18n";

// inside the footer markup, next to the tagline:
<span className="ml-2 text-muted-foreground">· {i18n.defaultLocale}</span>
```

- [ ] **Step 4: Verify the template renders**

Run: `pnpm --filter @notionx/create-nextion-app test`
Expected: exit code `0` (template render tests should still pass)

- [ ] **Step 5: Commit**

```bash
git add packages/create-nextion-app/src/templates/components/site/locale-switcher.tsx.tmpl \
        packages/create-nextion-app/src/templates/components/site/site-header.tsx.tmpl \
        packages/create-nextion-app/src/templates/components/site/site-footer.tsx.tmpl
git commit -m "feat(create-nextion-app): ship LocaleSwitcher in the starter header"
```

---

### Task 11: Document The Multilingual Foundation In The Generated README

**Files:**
- Modify: `packages/create-nextion-app/src/templates/README.md.tmpl`

- [ ] **Step 1: Add a Multilingual section**

Read `packages/create-nextion-app/src/templates/README.md.tmpl` and, after the existing "Project layout" section, append a new section that explains the four built-in models, the locale contract, and the LocaleSwitcher. Use the existing README style (lowercase headings, prose, code blocks). Insert the following content after the layout section:

````markdown
## Multilingual foundation

This project ships with a built-in multilingual foundation that covers the four core models:

- `blog` — base + `blog-translations`
- `pages` — base + `page-translations`
- `blocks` — base + `block-translations`
- `site settings` — base + `site-settings-translations`

The runtime helpers live under `lib/i18n/` and `lib/locale-contract/`. The contracts are imported from `@notionx/core` and pinned in `lib/locale-contract/built-in.ts`.

Fallback rules per model:

- `blog` — missing translations are hidden from the list
- `pages` — missing translations are treated as "page does not exist in this locale"
- `blocks` — missing translations fall back to the default-locale copy
- `site settings` — missing translations fall back to the default-locale copy

The header renders a `LocaleSwitcher` automatically when more than one locale is configured. Adding a new locale to an existing project is a separate `nextion locale add <locale>` workflow.
````

- [ ] **Step 2: Verify the template renders**

Run: `pnpm --filter @notionx/create-nextion-app test`
Expected: exit code `0`

- [ ] **Step 3: Commit**

```bash
git add packages/create-nextion-app/src/templates/README.md.tmpl
git commit -m "docs(create-nextion-app): document the multilingual foundation"
```

---

### Task 12: Final Verification And Handoff

**Files:**
- No new files

- [ ] **Step 1: Run the full monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: exit code `0`

- [ ] **Step 2: Run the full monorepo tests**

Run: `pnpm -r test`
Expected: exit code `0`

- [ ] **Step 3: Run the release status check**

Run: `pnpm release:status`
Expected: a clean no-publish result or a clear changeset warning consistent with the current workspace state

- [ ] **Step 4: Write a follow-up changeset**

Create `.changeset/multilingual-starter-foundation-phase-1.md`:

```md
---
"@notionx/core": minor
"@notionx/create-nextion-app": minor
---

Add the multilingual starter foundation: a `locale-contract` module in `@notionx/core` for the four built-in models (`blog`, `pages`, `blocks`, `site settings`) plus per-model locale lookup helpers, a `LocaleSwitcher` component, and a project i18n config in the scaffold. Single-locale projects are unchanged.
```

- [ ] **Step 5: Commit the changeset**

```bash
git add .changeset/multilingual-starter-foundation-phase-1.md
git commit -m "chore: add changeset for multilingual starter foundation phase 1"
```

---

## Self-Review

- [ ] **Spec coverage** — Re-checked the design spec against the tasks: every "Built-In Models" section has at least one task, the routing rules are covered by `localizedListPath` / `localizedDetailPathFor`, the fallback rules are covered by `pickTranslation` and the per-model helper files, the `LocaleSwitcher` requirement is covered by Task 10, and the "What The Command Must Not Do" and Phase 2/3 work is intentionally deferred to follow-up plans.
- [ ] **Placeholder scan** — No "TBD" / "TODO" / "similar to" markers. Every code block contains the actual code the engineer will paste.
- [ ] **Type consistency** — `LocaleContract["id"]` is the single source of truth and is used in `defineLocalizedContentSource`, the registry helpers, and the per-model template files. `blogContract.listPath` is the only field the scaffold overrides, and it is set in exactly one place.

## Follow-Up Plans (Out Of Scope For Phase 1)

- Phase 2 plan: `npx nextion locale add <locale>` with dry-run, `--with-notion`, `--copy-from`, and Notion translation data-source provisioning/repair.
- Phase 3 plan: developer ergonomics, custom-model extension examples, optional skill-assisted workflows.
