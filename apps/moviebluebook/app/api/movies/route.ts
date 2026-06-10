import { NextResponse } from "next/server";
import { filterItemsBySearchIndex } from "@/lib/content/search-index";
import { filterMoviesBySearch, normalizeSearchQuery } from "@/lib/content/search";
import { movieContentModel } from "@/lib/content/models";
import { getPublicNotionMoviesMeta } from "@/lib/notion/movies";
import { getRuntimePlatform } from "@/lib/platform/current";
import {
  publicJsonHeadersForListRequest,
  publicOptionsHeaders,
} from "@/lib/public-api";

export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");
  const query = normalizeSearchQuery(searchParams.get("q"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "60", 10), 100);

  let movies = await getPublicNotionMoviesMeta();
  if (genre) {
    movies = movies.filter((movie) => movie.genres.includes(genre));
  }
  movies = await filterItemsBySearchIndex(movies, query, {
    modelId: movieContentModel.id,
    filterFallback: filterMoviesBySearch,
    getDatabase: () => getRuntimePlatform().database,
  });
  movies = movies.slice(0, limit);

  const origin = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}`;

  return NextResponse.json(
    {
      total: movies.length,
      movies: movies.map((movie) => ({
        pageId: movie.pageId,
        routeId: movie.routeId,
        title: movie.title,
        releaseDate: movie.releaseDate,
        director: movie.director,
        actors: movie.actors,
        summary: movie.summary,
        genres: movie.genres,
        hasDownloadInfo: movie.hasDownloadInfo,
        coverImage: movie.coverImage,
        sourceUrl: movie.sourceUrl,
        url: `${origin}/movies/${movie.routeId}`,
      })),
    },
    {
      headers: publicJsonHeadersForListRequest(searchParams),
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: publicOptionsHeaders(),
  });
}
