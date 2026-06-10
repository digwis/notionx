import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { MovieBlocksPanel } from "@/components/MovieBlocksPanel";
import { MovieDownloadPanel } from "@/components/MovieDownloadPanel";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { blogContentModel, movieContentModel } from "@/lib/content/models";
import {
  isAppLocale,
  localizedMovieDetailPath,
  localizedMovieListPath,
  type AppLocale,
} from "@/lib/i18n/config";
import { getMovieUiMessages } from "@/lib/i18n/messages";
import {
  getAlternateLocalizedMovieSlugs,
  getLocalizedPublicMovieMetaBySlug,
} from "@/lib/notion/movie-localized";
import { getLocalizedMovieSlugParams } from "@/lib/notion/movie-translations";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Film,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return getLocalizedMovieSlugParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) return { title: "Not found" };

  const movie = await getLocalizedPublicMovieMetaBySlug(locale as AppLocale, slug);
  if (!movie) return { title: "Not found" };

  const alternates = await getAlternateLocalizedMovieSlugs(
    movie.pageId,
    locale as AppLocale
  );

  return {
    title: movie.seoTitle || movie.title,
    description: movie.seoDescription || movie.summary,
    alternates: {
      languages: Object.fromEntries([
        [locale, localizedMovieDetailPath(locale as AppLocale, movie.slug)],
        ...alternates.map((alternate) => [alternate.locale, alternate.href]),
      ]),
    },
    openGraph: {
      title: movie.seoTitle || movie.title,
      description: movie.seoDescription || movie.summary,
      type: "article",
      publishedTime: movie.releaseDate,
      images: movie.coverImage ? [{ url: movie.coverImage }] : undefined,
    },
  };
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="rounded-md border p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="leading-7">{value}</div>
    </div>
  );
}

export default async function LocalizedMovieDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) notFound();

  const appLocale = locale as AppLocale;
  const messages = getMovieUiMessages(appLocale);
  const movie = await getLocalizedPublicMovieMetaBySlug(appLocale, slug);
  if (!movie) notFound();

  const alternates = await getAlternateLocalizedMovieSlugs(movie.pageId, appLocale);
  const listPath = localizedMovieListPath(appLocale);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link
            href={listPath}
            className="inline-flex items-center text-sm font-medium hover:underline"
          >
            <Film className="mr-2 h-4 w-4" />
            {movieContentModel.ui.listTitle}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={appLocale} detailAlternates={alternates} />
            <Button asChild variant="ghost" size="sm">
              <Link href={blogContentModel.routes.listPath}>
                <BookOpen className="mr-1 h-3 w-3" />
                {blogContentModel.ui.navLabel}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <Shield className="mr-1 h-3 w-3" />
                {messages.admin}
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href={listPath}>
            <ArrowLeft className="mr-1 h-3 w-3" />
            {messages.backToList}
          </Link>
        </Button>

        <article>
          <div className="grid gap-8 md:grid-cols-[minmax(220px,320px)_1fr] md:items-start">
            <div className="overflow-hidden rounded-lg border bg-muted">
              {movie.coverImage ? (
                <PublicCoverImage
                  src={movie.coverImage}
                  alt={movie.title}
                  sizes="(max-width: 768px) 100vw, 320px"
                  className="aspect-[3/4] w-full object-cover"
                  index={0}
                  variant="detail"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center">
                  <Film className="h-16 w-16 text-muted-foreground/50" />
                </div>
              )}
            </div>

            <div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {movie.genres.map((genre) => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl font-bold tracking-tight">
                {movie.title}
              </h1>

              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                {movie.summary || messages.noSummary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {movie.sourceUrl && (
                  <Button asChild variant="outline">
                    <a href={movie.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      {messages.notionLink}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Fact
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label={messages.releaseDate}
              value={movie.releaseDate}
            />
            <Fact
              icon={<UserRound className="h-3.5 w-3.5" />}
              label={messages.director}
              value={movie.director}
            />
            <Fact
              icon={<UsersRound className="h-3.5 w-3.5" />}
              label={messages.actors}
              value={movie.actors}
            />
          </div>

          <MovieDownloadPanel
            movieId={movie.routeId}
            hasDownloadInfo={movie.hasDownloadInfo}
          />

          <MovieBlocksPanel movieId={movie.routeId} />
        </article>
      </main>
    </div>
  );
}
