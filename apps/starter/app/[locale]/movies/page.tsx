import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ContentCardBody,
  ContentCardCover,
  ContentCardFooter,
  ContentCardLink,
  ContentCardTags,
  ContentEmptyState,
  ContentGrid,
  ContentListHeader,
  ContentListIntro,
} from "@/components/ContentList";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { blogContentModel, movieContentModel } from "@/lib/content/models";
import { filterItemsBySearchIndex } from "@/lib/content/search-index";
import { filterMoviesBySearch, normalizeSearchQuery } from "@/lib/content/search";
import {
  isAppLocale,
  localizedMovieDetailPath,
  localizedMovieListPath,
  type AppLocale,
} from "@/lib/i18n/config";
import { getMovieUiMessages } from "@/lib/i18n/messages";
import { getLocalizedPublicMoviesMeta } from "@/lib/notion/movie-localized";
import { getRuntimePlatform } from "@/lib/platform/current";
import {
  BookOpen,
  CalendarDays,
  Film,
} from "lucide-react";

export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

function releaseYear(date: string, unknownYear: string) {
  return date ? date.slice(0, 4) : unknownYear;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return { title: "Not found" };
  const messages = getMovieUiMessages(locale);

  return {
    title: movieContentModel.ui.listTitle,
    description: messages.searchPlaceholder,
    alternates: {
      languages: Object.fromEntries(
        (["zh-CN", "en-US"] as const).map((currentLocale) => [
          currentLocale,
          localizedMovieListPath(currentLocale),
        ])
      ),
    },
  };
}

export default async function LocalizedMoviesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();

  const appLocale = locale as AppLocale;
  const messages = getMovieUiMessages(appLocale);
  const { q } = await searchParams;
  const searchQuery = normalizeSearchQuery(q);
  const allMovies = await getLocalizedPublicMoviesMeta(appLocale);
  const movies = await filterItemsBySearchIndex(allMovies, searchQuery, {
    modelId: movieContentModel.id,
    filterFallback: filterMoviesBySearch,
    getDatabase: () => getRuntimePlatform().database,
  });
  const listPath = localizedMovieListPath(appLocale);

  return (
    <div className="min-h-screen bg-background">
      <ContentListHeader
        currentHref={listPath}
        currentLabel={movieContentModel.ui.listTitle}
        currentIcon={<Film className="h-4 w-4" />}
        navItems={[
          {
            href: blogContentModel.routes.listPath,
            label: blogContentModel.ui.navLabel,
            icon: <BookOpen className="h-3 w-3" />,
          },
        ]}
      />

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher locale={appLocale} />
        </div>

        <ContentListIntro
          title={movieContentModel.ui.listTitle}
          description={movieContentModel.ui.listDescription}
          action={listPath}
          query={searchQuery}
          clearHref={listPath}
          placeholder={messages.searchPlaceholder}
          totalCount={allMovies.length}
          visibleCount={movies.length}
          itemLabel={messages.itemLabel}
          icon={<Film className="h-4 w-4" />}
        />

        {movies.length === 0 ? (
          <ContentEmptyState
            message={
              searchQuery ? messages.noSearchResults : movieContentModel.ui.emptyState
            }
          />
        ) : (
          <ContentGrid>
            {movies.map((movie, index) => (
              <ContentCardLink
                key={`${movie.routeId}:${movie.slug}`}
                href={localizedMovieDetailPath(appLocale, movie.slug)}
              >
                <ContentCardCover
                  src={movie.coverImage}
                  alt={movie.title}
                  aspectClassName="aspect-[3/4]"
                  index={index}
                  fallback={
                    <div className="flex flex-col items-center gap-3">
                      <Film className="h-12 w-12 opacity-50" />
                      <span className="text-sm">
                        {releaseYear(movie.releaseDate, messages.unknownYear)}
                      </span>
                    </div>
                  }
                />
                <ContentCardBody
                  title={movie.title}
                  description={movie.summary || messages.noSummary}
                >
                  <ContentCardFooter>
                    <ContentCardTags tags={movie.genres} />
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {movie.releaseDate || messages.unknownReleaseDate}
                    </span>
                  </ContentCardFooter>
                </ContentCardBody>
              </ContentCardLink>
            ))}
          </ContentGrid>
        )}
      </main>
    </div>
  );
}
