// GET /api/posts - 列出所有文章（JSON 公共 API）
// 用于第三方客户端（移动端、其他服务）拉取博客内容，无需走 HTML SSR

import { NextResponse } from "next/server";
import { filterItemsBySearchIndex } from "@/lib/content/search-index";
import { filterPostsBySearch, normalizeSearchQuery } from "@/lib/content/search";
import { getNotionPostsMeta } from "@/lib/notion/posts";
import { blogContentModel } from "@/lib/content/models";
import { getRuntimePlatform } from "@/lib/platform/current";
import {
  publicJsonHeadersForListRequest,
  publicOptionsHeaders,
} from "@/lib/public-api";

export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  const query = normalizeSearchQuery(searchParams.get("q"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  let posts = await getNotionPostsMeta();
  if (tag) {
    posts = posts.filter((p) => p.tags.includes(tag));
  }
  posts = await filterItemsBySearchIndex(posts, query, {
    modelId: blogContentModel.id,
    filterFallback: filterPostsBySearch,
    getDatabase: () => getRuntimePlatform().database,
  });
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
        coverImage: p.coverImage,
        url: `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}/blog/${p.slug}`,
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
