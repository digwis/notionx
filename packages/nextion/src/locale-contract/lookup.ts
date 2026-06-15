// packages/nextion/src/locale-contract/lookup.ts
//
// Pure translation lookup helpers. They never touch Notion — pass the
// already-loaded translation rows in. The three functions below cover
// the three fallback rules defined on `LocaleContract`:
//
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
  contract: LocaleContract,
  defaultLocale: string
): T | null {
  const direct = matchLocale(rows, locale);
  if (direct) return direct;
  if (contract.fallback === "default-locale" && defaultLocale !== locale) {
    return matchLocale(rows, defaultLocale);
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
