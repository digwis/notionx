// 博客数据源（SQL adapter 版）。
// 在 Server Component / Route Handler 里直接调用即可。
// 当前 Cloudflare 部署下由 D1 backing，后续可由平台 adapter 切换为其他 SQL 后端。
//
// tags 和 content 字段以 JSON 字符串存储，这里解析成数组。

import { cache } from "react";
import { getAdminListSelectClause } from "./admin-post-list";
import { getDatabase } from "./platform/current";

export type PostStatus = "draft" | "pending_review" | "published" | "rejected";

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  content: string[];
  cover_image: string | null;
  owner_email: string;
  status: PostStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type PostRow = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string;
  content: string;
  cover_image: string | null;
  owner_email: string | null;
  status: string | null;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function rowToPost(row: PostRow): Post {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    author: row.author,
    tags: JSON.parse(row.tags) as string[],
    content: JSON.parse(row.content) as string[],
    cover_image: row.cover_image,
    owner_email: row.owner_email ?? "",
    status: (row.status as PostStatus) ?? "draft",
    reject_reason: row.reject_reason,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
  };
}

/**
 * 公共文章：所有 status = published 的文章都会出现在前台，
 * 无论 owner 是谁。这是“管理员审核通过即公开”的核心语义。
 */
export async function getAllPosts(): Promise<Post[]> {
  const { results } = await getDatabase().prepare(
    `SELECT p.slug, p.title, p.description, p.date, p.author, p.tags, p.content, p.cover_image,
            p.owner_email, p.status, p.reject_reason, p.reviewed_by, p.reviewed_at
       FROM posts p
      WHERE p.status = 'published'
      ORDER BY p.date DESC`
  ).all<PostRow>();
  return results.map(rowToPost);
}

/** 公共文章（仅元数据，无正文）：列表页用，更轻量 */
export async function getAllPostsMeta(): Promise<
  Omit<Post, "content">[]
> {
  return getAllPostsMetaCached();
}

const getAllPostsMetaCached = cache(async (): Promise<
  Omit<Post, "content">[]
> => {
  const { results } = await getDatabase().prepare(
    `SELECT slug, title, description, date, author, tags, cover_image,
            owner_email, status, reject_reason, reviewed_by, reviewed_at
       FROM posts
      WHERE status = 'published'
      ORDER BY date DESC`
  ).all<Omit<PostRow, "content">>();
  return results.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    date: r.date,
    author: r.author,
    tags: JSON.parse(r.tags) as string[],
    cover_image: r.cover_image,
    owner_email: r.owner_email ?? "",
    status: (r.status as PostStatus) ?? "draft",
    reject_reason: r.reject_reason,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
  }));
});

/**
 * 后台列表使用：返回当前用户有权限查看的文章。
 * - 管理员 → 全部
 * - 普通用户 → 自己的
 *
 * 不在内部嵌套 perfSpan —— 列表的总体 span 已经在 page.tsx 那一层包好了，
 * 否则会产生重复日志。
 */
export async function getPostsForAdmin(viewerEmail: string, isAdmin: boolean): Promise<Post[]> {
  const sql = isAdmin
    ? `SELECT ${getAdminListSelectClause()}
         FROM posts
         ORDER BY date DESC`
    : `SELECT ${getAdminListSelectClause()}
         FROM posts
         WHERE owner_email = ?
         ORDER BY date DESC`;
  const stmt = getDatabase().prepare(sql);
  const bound = isAdmin ? stmt : stmt.bind(viewerEmail);
  const { results } = await bound.all<Omit<PostRow, "content">>();
  return results.map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date,
    author: row.author,
    tags: JSON.parse(row.tags) as string[],
    content: [],
    cover_image: row.cover_image,
    owner_email: row.owner_email ?? "",
    status: (row.status as PostStatus) ?? "draft",
    reject_reason: row.reject_reason,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
  }));
}

/** 管理员审核列表：只显示 status = pending_review */
export async function getPendingReviewPosts(): Promise<Post[]> {
  const { results } = await getDatabase().prepare(
    `SELECT slug, title, description, date, author, tags, content, cover_image,
            owner_email, status, reject_reason, reviewed_by, reviewed_at
       FROM posts
      WHERE status = 'pending_review'
      ORDER BY date DESC`
  ).all<PostRow>();
  return results.map(rowToPost);
}

export async function getPendingReviewCount(): Promise<number> {
  const row = await getDatabase().prepare(
    `SELECT COUNT(*) as count
       FROM posts
      WHERE status = 'pending_review'`
  ).first<{ count: number }>();

  return Number(row?.count ?? 0);
}

export async function getPostSlugs(): Promise<string[]> {
  return getPostSlugsCached();
}

const getPostSlugsCached = cache(async (): Promise<string[]> => {
  const { results } = await getDatabase().prepare(
    `SELECT slug
       FROM posts
      WHERE status = 'published'
      ORDER BY date DESC`
  ).all<{ slug: string }>();
  return results.map((r) => r.slug);
});

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return getPostBySlugCached(slug);
}

const getPostBySlugCached = cache(async (slug: string): Promise<Post | null> => {
  const row = await getDatabase().prepare(
    `SELECT slug, title, description, date, author, tags, content, cover_image,
            owner_email, status, reject_reason, reviewed_by, reviewed_at
       FROM posts
      WHERE slug = ?
        AND status = 'published'`
  ).bind(slug)
   .first<PostRow>();
  return row ? rowToPost(row) : null;
});

/** 后台编辑/删除/审核前用：返回真实归属关系（不做可见性过滤） */
export async function getPostBySlugRaw(slug: string): Promise<Post | null> {
  return getPostBySlugRawCached(slug);
}

const getPostBySlugRawCached = cache(async (slug: string): Promise<Post | null> => {
  const row = await getDatabase().prepare(
    `SELECT slug, title, description, date, author, tags, content, cover_image,
            owner_email, status, reject_reason, reviewed_by, reviewed_at
       FROM posts WHERE slug = ?`
  ).bind(slug)
   .first<PostRow>();
  return row ? rowToPost(row) : null;
});

// —— 写入操作 ——

export type NewPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  content: string[];
  cover_image?: string | null;
  owner_email: string;
  /** 管理员自己创建的内容直接 published；其他用户进入草稿 */
  status?: PostStatus;
};

export type PostInput = Omit<NewPost, "slug" | "owner_email" | "status">;

export async function createPost(input: NewPost): Promise<void> {
  await getDatabase().prepare(
    "INSERT INTO posts (slug, title, description, date, author, tags, content, cover_image, owner_email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      input.slug,
      input.title,
      input.description,
      input.date,
      input.author,
      JSON.stringify(input.tags),
      JSON.stringify(input.content),
      input.cover_image ?? null,
      input.owner_email,
      input.status ?? "draft"
    )
    .run();
}

export async function updatePost(slug: string, input: PostInput): Promise<void> {
  await getDatabase().prepare(
    "UPDATE posts SET title = ?, description = ?, date = ?, author = ?, tags = ?, content = ?, cover_image = ? WHERE slug = ?"
  )
    .bind(
      input.title,
      input.description,
      input.date,
      input.author,
      JSON.stringify(input.tags),
      JSON.stringify(input.content),
      input.cover_image ?? null,
      slug
    )
    .run();
}

export async function deletePost(slug: string): Promise<void> {
  await getDatabase().prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
}

// —— 审核状态操作 ——

export async function setPostStatus(
  slug: string,
  status: PostStatus,
  options?: { reviewedBy?: string | null; rejectReason?: string | null }
): Promise<void> {
  const reviewedBy = options?.reviewedBy ?? null;
  const rejectReason = options?.rejectReason ?? null;
  await getDatabase().prepare(
    `UPDATE posts
        SET status = ?,
            reject_reason = ?,
            reviewed_by = ?,
            reviewed_at = datetime('now')
      WHERE slug = ?`
  )
    .bind(status, rejectReason, reviewedBy, slug)
    .run();
}

export async function slugExists(slug: string): Promise<boolean> {
  const row = await getDatabase().prepare(
    "SELECT 1 AS x FROM posts WHERE slug = ?"
  )
    .bind(slug)
    .first<{ x: number }>();
  return row !== null;
}
