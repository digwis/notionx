import { NextResponse } from "next/server";
import { getAuthViewer } from "@/lib/auth";
import { getNotionMovieDownloadInfo } from "@/lib/notion/movies";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(_request: Request, { params }: Props) {
  const viewer = await getAuthViewer();
  if (!viewer) {
    return jsonResponse(
      { ok: false, reason: "unauthenticated" },
      { status: 401 }
    );
  }

  if (!viewer.canViewVipContent) {
    return jsonResponse({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const info = await getNotionMovieDownloadInfo(id);
  if (!info) {
    return jsonResponse({ ok: false, reason: "not_found" }, { status: 404 });
  }

  return jsonResponse({
    ok: true,
    title: info.title,
    hasDownloadInfo: info.hasDownloadInfo,
    downloadUrl: info.downloadUrl,
    extractionCode: info.extractionCode,
  });
}
