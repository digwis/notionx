// GET /api/posts/[slug] - 单篇文章 JSON
// 第三方拉单篇完整内容（带正文）

import { NextResponse } from "next/server";
import { getNotionPostBySlug } from "@/lib/notion/posts";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Props) {
  const { slug } = await params;
  const post = await getNotionPostBySlug(slug);

  if (!post) {
    return NextResponse.json(
      { error: "Post not found", slug },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      ...post,
      url: `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}/blog/${post.slug}`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
