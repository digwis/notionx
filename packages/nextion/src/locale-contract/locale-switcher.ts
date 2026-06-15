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
