import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function sourceFilesUnder(...roots) {
  const files = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else if (entry.isFile() && /\.(?:ts|tsx|mjs)$/.test(file)) {
        files.push(path.relative(projectRoot, file));
      }
    }
  }

  for (const root of roots) {
    walk(path.join(projectRoot, root));
  }

  return files;
}

test("admin layout no longer runs bootstrap on every request", () => {
  const source = read("app/admin/layout.tsx");
  assert.doesNotMatch(source, /ensureAdminBootstrap/);
});

test("settings helpers use request-scoped cache wrappers", () => {
  const source = read("lib/settings.ts");
  assert.match(source, /cache\(/);
});

test("database-backed business modules use runtime database adapter", () => {
  const settings = read("lib/settings.ts");
  const rateLimit = read("lib/auth-rate-limit.ts");
  const users = read("lib/users.ts");
  const posts = read("lib/posts.ts");
  const health = read("app/api/health/route.ts");

  assert.match(settings, /getDatabase/);
  assert.match(rateLimit, /getDatabase/);
  assert.match(users, /getDatabase/);
  assert.match(posts, /getDatabase/);
  assert.match(health, /getDatabase/);
  assert.doesNotMatch(settings, /env\.DB|workerEnv\.DB/);
  assert.doesNotMatch(rateLimit, /env\.DB|workerEnv\.DB/);
  assert.doesNotMatch(users, /env\.DB|workerEnv\.DB/);
  assert.doesNotMatch(posts, /env\.DB|workerEnv\.DB|cloudflare:workers/);
  assert.doesNotMatch(health, /env\.DB|workerEnv\.DB/);
});

test("edge cache consumers use runtime public cache adapter", () => {
  const worker = read("worker/index.ts");
  const notionMedia = read("app/api/notion/media/[...ref]/route.ts");
  const actions = read("lib/actions.ts");
  const runtime = read("lib/platform/cloudflare-runtime.ts");
  const viteConfig = read("vite.config.ts");

  assert.match(viteConfig, /cdnAdapter\(/);
  assert.match(viteConfig, /kvDataAdapter\(/);
  assert.match(notionMedia, /getPublicCache/);
  assert.match(actions, /revalidatePath/);
  assert.doesNotMatch(worker, /getPublicCache|publicCacheKey|publicApiCacheKeyForUrl/);
  assert.match(runtime, /globalThis/);
  assert.match(runtime, /getDefaultCloudflareCache/);
  assert.match(runtime, /publicCache: getDefaultCloudflareCache/);
  assert.doesNotMatch(notionMedia, /caches\.default/);
});

test("content revalidation API is token-gated", () => {
  const route = read("app/api/content/revalidate/route.ts");
  const helper = read("lib/content/revalidate.ts");
  const config = read("lib/notion/config.ts");

  assert.match(route, /authorizeContentRevalidate/);
  assert.match(route, /getNotionWebhookVerificationToken/);
  assert.match(helper, /Bearer/);
  assert.match(config, /NOTION_WEBHOOK_VERIFICATION_TOKEN/);
});

test("notion webhook API verifies Notion signatures", () => {
  const route = read("app/api/notion/webhook/route.ts");
  const helper = read("lib/notion/webhook.ts");

  assert.match(route, /verifyNotionWebhookSignatureWithTokens/);
  assert.match(route, /putStoredNotionWebhookVerificationToken/);
  assert.match(route, /x-notion-signature/);
  assert.match(helper, /HMAC/);
  assert.match(helper, /SHA-256/);
});

test("business code imports the current platform facade", () => {
  const offenders = sourceFilesUnder("lib", "app", "worker").filter((file) => {
    if (file === "lib/platform/current.ts") return false;
    if (file === "lib/platform/cloudflare-runtime.ts") return false;
    if (file === "lib/admin-performance-guard.test.mjs") return false;
    const source = read(file);
    return source.includes("platform/cloudflare-runtime");
  });

  assert.deepEqual(offenders, []);

  const facade = read("lib/platform/current.ts");
  const selection = read("lib/platform/selection.ts");
  assert.match(facade, /currentRuntimeId/);
  const removedRuntimePattern = new RegExp(
    "VINEXT" + "_RUNTIME|ver" + "cel",
    "i"
  );
  assert.doesNotMatch(selection, removedRuntimePattern);
  assert.doesNotMatch(facade, removedRuntimePattern);
});

test("turnstile field no longer posts debug events to localhost", () => {
  const source = read("components/TurnstileField.tsx");
  assert.doesNotMatch(source, /127\.0\.0\.1:7777/);
  assert.doesNotMatch(source, /reportDebug/);
});

test("admin list uses Notion handoff instead of D1 delete actions", () => {
  const source = read("app/admin/page.tsx");
  assert.match(source, /getNotionPostsMeta/);
  assert.match(source, /getNotionEditBaseUrl/);
  assert.doesNotMatch(source, /DeleteButton/);
});

test("new post page hands off content creation to Notion", () => {
  const source = read("app/admin/new/page.tsx");
  assert.match(source, /AdminNotionPostCard/);
  assert.match(source, /getNotionEditBaseUrl/);
  assert.doesNotMatch(source, /NewPostForm/);
});

test("admin route defines a dedicated content-only loading state", () => {
  const source = read("app/admin/loading.tsx");
  assert.match(source, /Skeleton/);
  assert.doesNotMatch(source, /vinext Admin/);
});

test("admin exposes content model registry without write actions", () => {
  const layout = read("app/admin/layout.tsx");
  const page = read("app/admin/content-models/page.tsx");
  const summary = read("lib/content/admin-summary.ts");

  assert.match(layout, /\/admin\/content-models/);
  assert.match(page, /getContentModelAdminSummaries/);
  assert.match(summary, /capabilities/);
  assert.match(page, /新领域由 AI 直接新增模型、路由和 UI 代码/);
  assert.doesNotMatch(page, /<form|action=/);
});
