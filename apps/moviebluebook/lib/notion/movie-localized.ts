import { cache } from "react";
import {
  defaultLocale,
  localizedMovieDetailPath,
  type AppLocale,
} from "../i18n/config.ts";
import { isAppLocale } from "../i18n/config.ts";
import {
  compactNotionId,
  getNotionMovieByRouteId,
  getPublicNotionMovieMetaByRouteId,
  getPublicNotionMoviesMeta,
} from "./movies.ts";
import {
  getPublishedMovieTranslationBySlug,
  getPublishedMovieTranslations,
  getPublishedMovieTranslationsForLocale,
} from "./movie-translations.ts";
import type {
  LocalizedPublicMovieDetail,
  LocalizedPublicMovieListItem,
  NotionMovieTranslation,
  PublicNotionMovieListItem,
} from "./types.ts";

function applyTranslationToMovie(
  movie: PublicNotionMovieListItem,
  translation: NotionMovieTranslation,
  locale: AppLocale
): LocalizedPublicMovieListItem {
  return {
    ...movie,
    locale,
    slug: translation.slug,
    title: translation.title || movie.title,
    director: translation.director || movie.director,
    actors: translation.actors || movie.actors,
    summary: translation.summary || movie.summary,
    genres: translation.genres.length ? translation.genres : movie.genres,
    seoTitle: translation.seoTitle || translation.title || movie.title,
    seoDescription:
      translation.seoDescription || translation.summary || movie.summary,
  };
}

function fallbackLocalizedMovies(locale: AppLocale) {
  return getPublicNotionMoviesMeta().then((movies) =>
    movies.map((movie) => ({
      ...movie,
      locale,
      slug: movie.routeId,
      seoTitle: movie.title,
      seoDescription: movie.summary,
    }))
  );
}

async function buildLocalizedMovieList(locale: AppLocale) {
  const translations = await getPublishedMovieTranslationsForLocale(locale);
  if (translations.length === 0) {
    // 默认语言始终回退到原 Notion 电影库：
    // 翻译是叠加层，原电影库（中文）才是默认语言的内容源。
    if (locale === defaultLocale) {
      return fallbackLocalizedMovies(locale);
    }
    return [];
  }

  const movies = await getPublicNotionMoviesMeta();
  const movieByPageId = new Map(
    movies.map((movie) => [compactNotionId(movie.pageId), movie])
  );

  return translations
    .map((translation) => {
      const movie = movieByPageId.get(compactNotionId(translation.moviePageId));
      if (!movie) return null;
      return applyTranslationToMovie(movie, translation, locale);
    })
    .filter((movie): movie is LocalizedPublicMovieListItem => Boolean(movie))
    .sort((left, right) => right.releaseDate.localeCompare(left.releaseDate));
}

export const getLocalizedPublicMoviesMeta = cache(
  async (locale: AppLocale): Promise<LocalizedPublicMovieListItem[]> => {
    if (!isAppLocale(locale)) return [];
    return buildLocalizedMovieList(locale);
  }
);

async function resolveTranslationForSlug(locale: AppLocale, slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const translation = await getPublishedMovieTranslationBySlug(
    locale,
    normalizedSlug
  );
  if (translation) return translation;

  // 默认语言没有翻译时，回退到原 Notion 电影库里的电影。
  if (locale === defaultLocale) {
    const movie = await getPublicNotionMovieMetaByRouteId(normalizedSlug);
    if (!movie) return null;
    return {
      pageId: movie.pageId,
      moviePageId: movie.pageId,
      locale,
      slug: movie.routeId,
      title: movie.title,
      director: movie.director,
      actors: movie.actors,
      summary: movie.summary,
      genres: movie.genres,
      seoTitle: movie.title,
      seoDescription: movie.summary,
      published: true,
      editUrl: movie.editUrl,
      sourceUrl: movie.sourceUrl,
    } satisfies NotionMovieTranslation;
  }

  return null;
}

export const getLocalizedPublicMovieMetaBySlug = cache(
  async (
    locale: AppLocale,
    slug: string
  ): Promise<LocalizedPublicMovieListItem | null> => {
    if (!isAppLocale(locale)) return null;

    const translation = await resolveTranslationForSlug(locale, slug);
    if (!translation) return null;

    const movie = await getPublicNotionMovieMetaByRouteId(
      compactNotionId(translation.moviePageId)
    );
    if (!movie) return null;

    return applyTranslationToMovie(movie, translation, locale);
  }
);

export const getLocalizedPublicMovieBySlug = cache(
  async (
    locale: AppLocale,
    slug: string
  ): Promise<LocalizedPublicMovieDetail | null> => {
    const movie = await getLocalizedPublicMovieMetaBySlug(locale, slug);
    if (!movie) return null;

    const detail = await getNotionMovieByRouteId(movie.routeId);
    if (!detail) return null;

    return {
      ...movie,
      blocks: detail.blocks,
    };
  }
);

export const getAlternateLocalizedMovieSlugs = cache(
  async (moviePageId: string, currentLocale: AppLocale) => {
    const translations = await getPublishedMovieTranslations();
    const normalizedMoviePageId = compactNotionId(moviePageId);

    return translations
      .filter(
        (translation) =>
          compactNotionId(translation.moviePageId) === normalizedMoviePageId &&
          isAppLocale(translation.locale) &&
          translation.locale !== currentLocale
      )
      .map((translation) => ({
        locale: translation.locale as AppLocale,
        slug: translation.slug,
        href: localizedMovieDetailPath(
          translation.locale as AppLocale,
          translation.slug
        ),
        label: translation.locale,
      }));
  }
);

export async function getPublishedTranslationPathsForMovieRouteId(
  routeId: string
) {
  const translations = await getPublishedMovieTranslations();
  const normalizedRouteId = compactNotionId(routeId);

  return translations
    .filter(
      (translation) =>
        compactNotionId(translation.moviePageId) === normalizedRouteId &&
        isAppLocale(translation.locale)
    )
    .map((translation) =>
      localizedMovieDetailPath(translation.locale as AppLocale, translation.slug)
    );
}
