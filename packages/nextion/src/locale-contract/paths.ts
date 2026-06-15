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
