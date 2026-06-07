// Cloudflare bindings —— 由 @cloudflare/vite-plugin 在 workerd 运行时注入。
// 在 RSC / SSR 环境中可 `import { env } from "cloudflare:workers"` 访问。

/// <reference types="@cloudflare/workers-types" />

interface VinextEnv extends Env {
  // D1 binding
  DB: D1Database;
  // 管理员密码：dev 走 .dev.vars，prod 走 `wrangler secret put ADMIN_PASSWORD`
  ADMIN_PASSWORD?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DATA_SOURCE_ID?: string;
  NOTION_MOVIES_DATA_SOURCE_ID?: string;
  NOTION_API_BASE_URL?: string;
  NOTION_EDIT_BASE_URL?: string;
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
}

declare module "cloudflare:workers" {
  export const env: VinextEnv;
  export const ctx: ExecutionContext;
}

export {};
