import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import NotionBlockRenderer from "@/components/NotionBlockRenderer";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getNotionMovieByRouteId,
  getNotionMovieRouteIds,
} from "@/lib/notion/movies";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Download,
  ExternalLink,
  Film,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const ids = await getNotionMovieRouteIds();
  return ids.map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movie = await getNotionMovieByRouteId(id);
  if (!movie) return { title: "Not found" };

  return {
    title: movie.title,
    description: movie.summary,
    openGraph: {
      title: movie.title,
      description: movie.summary,
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

export default async function MovieDetailPage({ params }: Props) {
  const { id } = await params;
  const movie = await getNotionMovieByRouteId(id);
  if (!movie) notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link
            href="/movies"
            className="inline-flex items-center text-sm font-medium hover:underline"
          >
            <Film className="mr-2 h-4 w-4" />
            电影数据库
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/blog">
                <BookOpen className="mr-1 h-3 w-3" />
                Blog
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <Shield className="mr-1 h-3 w-3" />
                Admin
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/movies">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回电影列表
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
                {movie.summary || "暂无剧情简介。"}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {movie.downloadUrl && (
                  <Button asChild>
                    <a href={movie.downloadUrl} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                      下载地址
                    </a>
                  </Button>
                )}
                {movie.sourceUrl && (
                  <Button asChild variant="outline">
                    <a href={movie.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Notion
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Fact
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="上映时间"
              value={movie.releaseDate}
            />
            <Fact
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="导演"
              value={movie.director}
            />
            <Fact
              icon={<UsersRound className="h-3.5 w-3.5" />}
              label="演员"
              value={movie.actors}
            />
          </div>

          {movie.blocks.length > 0 && (
            <>
              <Separator className="my-8" />
              <NotionBlockRenderer blocks={movie.blocks} />
            </>
          )}
        </article>
      </main>
    </div>
  );
}
