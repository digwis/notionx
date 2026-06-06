// GET /api/posts - 列出所有文章（JSON 公共 API）
// 用于第三方客户端（移动端、其他服务）拉取博客内容，无需走 HTML SSR

import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  let posts = await getAllPosts();
  if (tag) {
    posts = posts.filter((p) => p.tags.includes(tag));
  }
  posts = posts.slice(0, limit);

  return NextResponse.json(
    {
      total: posts.length,
      posts: posts.map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        date: p.date,
        author: p.author,
        tags: p.tags,
        url: `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}/blog/${p.slug}`,
      })),
    },
    {
      headers: {
        // 跨域：让浏览器从任何域都能调（移动端调试友好）
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        // 边缘缓存 5 分钟（CDN 命中，零 RSC 计算）。后台审核后 revalidatePath("/blog") 会强制刷新。
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
