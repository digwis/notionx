import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import { ThemeToggle } from "@/components/theme-toggle";
import { getNotionMoviesMeta } from "@/lib/notion/movies";
import { ArrowRight, BookOpen, CalendarDays, Film, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "电影数据库",
  description: "从 Notion 电影数据库实时读取并展示的影片目录。",
};

export const revalidate = 300;

function releaseYear(date: string) {
  return date ? date.slice(0, 4) : "未知年份";
}

export default async function MoviesPage() {
  const movies = await getNotionMoviesMeta();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link
            href="/"
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

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Notion Source
            </p>
            <h1 className="text-4xl font-bold tracking-tight">电影数据库</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              影片资料直接来自 Notion。条目里的海报、剧照、视频和正文块会在详情页按 Notion 内容渲染。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            <Film className="h-4 w-4" />
            <span>{movies.length} 部影片</span>
          </div>
        </div>

        {movies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              还没有可显示的电影条目，或当前环境还没有配置 Notion token。
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((movie, index) => (
              <Link
                key={movie.routeId}
                href={`/movies/${movie.routeId}`}
                className="group block"
              >
                <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-1 group-hover:border-foreground/30 group-hover:shadow-lg">
                  {movie.coverImage ? (
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                      <PublicCoverImage
                        src={movie.coverImage}
                        alt={movie.title}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        index={index}
                        variant="list"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-muted text-muted-foreground">
                      <Film className="h-12 w-12 opacity-50" />
                      <span className="text-sm">{releaseYear(movie.releaseDate)}</span>
                    </div>
                  )}

                  <CardHeader className="flex-1">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {movie.genres.slice(0, 3).map((genre) => (
                        <Badge key={genre} variant="secondary">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="line-clamp-2 text-xl leading-tight group-hover:underline">
                      {movie.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {movie.summary || "暂无剧情简介"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {movie.releaseDate || "未知上映时间"}
                      </span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
