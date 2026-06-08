import { NextResponse } from "next/server";
import { getPublicNotionMoviesMeta } from "@/lib/notion/movies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get("genre");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "60", 10), 100);

  let movies = await getPublicNotionMoviesMeta();
  if (genre) {
    movies = movies.filter((movie) => movie.genres.includes(genre));
  }
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
