import { NextResponse } from "next/server";
import { publicMediaBlockForApi } from "@/lib/notion/media";
import { getPublicNotionMovieByRouteId } from "@/lib/notion/movies";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Props) {
  const { id } = await params;
  const movie = await getPublicNotionMovieByRouteId(id);
  if (!movie) {
    return NextResponse.json(
      { error: "Movie not found", id },
      { status: 404 }
    );
  }

  const origin = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}`;

  return NextResponse.json(
    {
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
      blocks: movie.blocks.map(publicMediaBlockForApi),
      url: `${origin}/movies/${movie.routeId}`,
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
