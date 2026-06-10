// GET /api/posts/[slug] - 单篇文章 JSON
// 第三方拉单篇完整内容（带正文）

import { NextResponse } from "next/server";
import { publicMediaBlockForApi } from "@/lib/notion/media";
import { getNotionPostBySlug } from "@/lib/notion/posts";
import { publicJsonHeaders } from "@/lib/public-api";

export const revalidate = 60;

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
      blocks: post.blocks.map(publicMediaBlockForApi),
      url: `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}/blog/${post.slug}`,
    },
    {
      headers: publicJsonHeaders(),
    }
  );
}
