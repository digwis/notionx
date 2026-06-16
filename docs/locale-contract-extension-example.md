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

`notionx update` will repair this secret on every run, the same way it repairs the built-in ones.

## 6. Render the new model

The existing `app/[slug]/page.tsx` route is generic — pass it a new `key` like `products` and it will look up `product-translations` and render the locale-aware list. Use `buildLocaleSwitcherLinks` with `productsContract` to render a `LocaleSwitcher` for the model.

That's it. The starter now has a `products` model that participates in the same locale foundation as the built-in four.
