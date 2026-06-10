import { NextResponse } from "next/server";
import { gatedMediaBlockForApi } from "@/lib/notion/media";
import { getPublicNotionMovieByRouteId } from "@/lib/notion/movies";
import { publicJsonHeaders, publicOptionsHeaders } from "@/lib/public-api";

export const revalidate = 60;

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
      blocks: movie.blocks.map((block) =>
        gatedMediaBlockForApi(block, { movieId: movie.routeId })
      ),
      url: `${origin}/movies/${movie.routeId}`,
    },
    {
      headers: publicJsonHeaders(),
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: publicOptionsHeaders(),
  });
}
