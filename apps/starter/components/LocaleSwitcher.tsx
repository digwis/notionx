import Link from "next/link";
import {
  localizedMovieListPath,
  supportedLocales,
  type AppLocale,
} from "@/lib/i18n/config";
import { getMovieUiMessages } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";

type Props = {
  locale: AppLocale;
  detailAlternates?: ReadonlyArray<{
    locale: AppLocale;
    href: string;
    label: string;
  }>;
};

export function LocaleSwitcher({ locale, detailAlternates = [] }: Props) {
  const messages = getMovieUiMessages(locale);

  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">{messages.languageLabel}</span>
      {supportedLocales.map((supportedLocale) => {
        const alternate = detailAlternates.find(
          (item) => item.locale === supportedLocale
        );
        const href =
          alternate?.href ?? localizedMovieListPath(supportedLocale);
        const isActive = supportedLocale === locale;

        return (
          <Button
            key={supportedLocale}
            asChild
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
          >
            <Link href={href} hrefLang={supportedLocale}>
              {supportedLocale}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
