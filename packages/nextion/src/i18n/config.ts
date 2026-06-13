export type I18nConfig<TLocale extends string = string> = {
  supportedLocales: readonly TLocale[];
  defaultLocale: TLocale;
};

export function defineI18nConfig<const TLocale extends string>(
  config: I18nConfig<TLocale>
) {
  return config;
}

export function isSupportedLocale<TLocale extends string>(
  config: I18nConfig<TLocale>,
  value: string
): value is TLocale {
  return (config.supportedLocales as readonly string[]).includes(value);
}

export function localesForExpansion<TLocale extends string>(
  config: I18nConfig<TLocale>,
  locale?: string
) {
  return locale && isSupportedLocale(config, locale)
    ? [locale]
    : [...config.supportedLocales];
}

export function localizedPath(locale: string, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function localizedDetailPath(
  locale: string,
  listPath: string,
  slug: string
) {
  const normalizedListPath = listPath.replace(/\/+$/, "");
  const normalizedSlug = slug.replace(/^\/+/, "");
  return localizedPath(locale, `${normalizedListPath}/${normalizedSlug}`);
}

export function expandLocalizedPaths<TLocale extends string>(input: {
  paths: readonly string[];
  config: I18nConfig<TLocale>;
  locale?: string;
  shouldLocalize?: (path: string) => boolean;
}) {
  const locales = localesForExpansion(input.config, input.locale);
  const expanded: string[] = [];

  for (const path of input.paths) {
    if (!input.shouldLocalize || input.shouldLocalize(path)) {
      for (const currentLocale of locales) {
        expanded.push(localizedPath(currentLocale, path));
      }
      continue;
    }
    expanded.push(path);
  }

  return Array.from(new Set(expanded));
}
