# Multilingual Architecture

## Overview

Notionx supports true multilingual sites through a four-layer design:
locale contracts, path helpers, translation lookup, and translation
data sources. Selecting "bilingual" at scaffold time produces a site
that serves every locale across blog, pages, blocks, and site-settings.

## Layers

### 1. Locale Contract (`@notionx/core/locale-contract`)

A `LocaleContract` defines the relationship between a base content
source and its translation source, plus a fallback rule. Four
built-in contracts cover the starter models:

| Contract | Base | Translation | Fallback |
|---|---|---|---|
| `blogContract` | `blog` | `blog-translations` | `hide` |
| `pagesContract` | `pages` | `page-translations` | `strict-missing` |
| `blocksContract` | `blocks` | `block-translations` | `default-locale` |
| `siteSettingsContract` | `site-settings` | `site-settings-translations` | `default-locale` |

### 2. Path Helpers (`locale-contract/paths.ts`)

- Default locale: unprefixed (`/blog`)
- Non-default locale: prefixed (`/zh-CN/blog`)
- `localizedListPath(locale, contract, defaultLocale)`
- `localizedDetailPathFor(locale, slug, contract, defaultLocale)`
- `stripLocalePrefix(path, locale)`

### 3. Translation Lookup (`locale-contract/lookup.ts`)

- `pickTranslation(rows, locale, contract, defaultLocale)` — respects the contract's fallback rule
- `pickTranslationOrDefault(rows, locale, defaultLocale, contract)` — always falls back to default
- `hideWhenMissing(rows, locale)` — filters to only matching locale

### 4. Routing (Next.js Middleware)

A `middleware.ts` at the project root parses the `/{locale}` prefix,
sets `x-notionx-locale` on the request header, and rewrites the URL
to strip the prefix. The worker entry reads the header and threads
it into the request env (AsyncLocalStorage). Server components and
data loaders call `getRequestLocale()` to pick the right translation
rows.

## Data Flow

```
Request → middleware.ts (parse /{locale} prefix)
       → x-notionx-locale header
       → worker/index.ts (read header → NOTIONX_LOCALE in RequestEnv)
       → getRequestLocale() in server components
       → listGenericNotionContentForLocale(model, locale)
       → createLocalizedGenericNotionContentSource (merges base + translation)
       → localizeContentList (applies contract fallback rule)
       → rendered page
```

## Scaffold Flow

When bilingual mode is selected:

1. The scaffolder creates four translation Notion databases with
   full property schemas (Source relation, Locale select, Title,
   Slug, Body, etc.).
2. The database ids are written into `wrangler.jsonc` vars,
   `.dev.vars`, and `.notionx/scaffold.json#translationSources`.
3. The generated `lib/content/models.ts` declares four
   `*TranslationsSource` variables.
4. The generated `middleware.ts` parses locale prefixes.
5. The generated route templates call
   `listGenericNotionContentForLocale` and
   `getGenericNotionContentBySlugForLocale` with the request locale.

## `notionx locale add <locale>`

Extends an existing project with a new locale:

1. Appends the locale to `lib/i18n/config.ts` and `lib/site/config.ts`.
2. Creates or reuses the four translation data sources (idempotent).
3. Sets Cloudflare worker secrets for the new translation source ids.
4. Updates `.notionx/scaffold.json#translationSources`.

## Translation Source Schemas

Each translation database has a `Source` relation property pointing
to its base database, a `Locale` select property, and
content-specific properties:

### blog-translations
Title, Source (relation), Locale (select), Slug, Description, SEO Title, SEO Description, Body, Published

### page-translations
Title, Source (relation), Locale (select), Slug, Description, SEO Title, SEO Description, Nav Label, Footer Label, Body, Published

### block-translations
Title, Source (relation), Locale (select), Description, Eyebrow, Headline, Subheadline, Body, Quote, Quote Attribution, Primary CTA Label, Primary CTA Href, Secondary CTA Label, Secondary CTA Href, Published

### site-settings-translations
Title, Source (relation), Locale (select), Tagline, Description, SEO Title, SEO Description, Nav Labels, Footer Labels, Global Fallback Copy, Published
