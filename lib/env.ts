// lib/env.ts - 集中获取 Cloudflare bindings
// 用 cloudflare:workers 模块（workerd 内置），与 lib/posts.ts 风格一致

/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:workers";

export type AppEnv = {
  DB: D1Database;
  ASSETS: Fetcher;
  IMAGES: ImagesBinding;
  ASSETS_BUCKET?: R2Bucket;
  ADMIN_PASSWORD: string;
  ADMIN_EMAIL?: string;
  SITE_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  // Google OAuth 仍然兼容 Cloudflare Secret 作为兜底。
  // 实际生效值以 app_settings.google_client_id / google_client_secret 为准。
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Turnstile site key fallback when not stored in app_settings */
  TURNSTILE_SITE_KEY?: string;
  /** Turnstile secret — set via `wrangler secret put TURNSTILE_SECRET_KEY` */
  TURNSTILE_SECRET_KEY?: string;
  /** Notion integration token for the blog data source */
  NOTION_TOKEN?: string;
  /** Notion data source ID used by dataSources.query */
  NOTION_DATA_SOURCE_ID?: string;
  /** Notion data source ID for the public movie catalog */
  NOTION_MOVIES_DATA_SOURCE_ID?: string;
  /** Optional Notion API base URL for tests or proxies */
  NOTION_API_BASE_URL?: string;
  /** Optional Notion edit URL for admin handoff screens */
  NOTION_EDIT_BASE_URL?: string;
  /** Optional webhook verification token for Notion invalidation */
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
};

// 强制类型：vinext 把 env 类型放在 env.d.ts（interface VinextEnv extends Env），
// 但 TS server 经常解析不到。运行时一定有 DB，类型断言保证编译通过。
export const workerEnv = env as unknown as AppEnv;
