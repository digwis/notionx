export type LocaleMessages<
  TLocale extends string = string,
  TMessages extends object = Record<string, string>,
> = Record<TLocale, TMessages>;

export function getLocaleMessages<
  TLocale extends string,
  TMessages extends object,
>(messages: LocaleMessages<TLocale, TMessages>, locale: TLocale): TMessages {
  return messages[locale];
}
