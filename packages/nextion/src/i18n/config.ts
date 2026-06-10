export const supportedLocales = ["zh-CN", "en-US"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "zh-CN";

export function isAppLocale(value: string): value is AppLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

export function localizedMovieListPath(locale: AppLocale) {
  return `/${locale}/movies`;
}

export function localizedMovieDetailPath(locale: AppLocale, slug: string) {
  return `/${locale}/movies/${slug}`;
}

export function expandLocalizedMoviePaths(
  paths: readonly string[],
  locale?: string
) {
  const locales =
    locale && isAppLocale(locale) ? [locale] : [...supportedLocales];
  const expanded: string[] = [];

  for (const path of paths) {
    if (path === "/movies" || path.startsWith("/movies/")) {
      for (const currentLocale of locales) {
        expanded.push(`/${currentLocale}${path}`);
      }
      continue;
    }
    expanded.push(path);
  }

  return Array.from(new Set(expanded));
}
