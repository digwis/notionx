import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("content prewarm covers built-in public Notion models", () => {
  const source = fs.readFileSync(
    path.join(root, "lib/content/prewarm.ts"),
    "utf8"
  );

  assert.match(source, /blogContentModel\.id/);
  assert.match(source, /movieContentModel\.id/);
  assert.match(source, /prewarmNotionPostsSearchIndex/);
  assert.match(source, /prewarmNotionMoviesSearchIndex/);
});

test("manual prewarm endpoint is protected by the revalidate bearer token", () => {
  const source = fs.readFileSync(
    path.join(root, "app/api/content/prewarm/route.ts"),
    "utf8"
  );

  assert.match(source, /authorizeContentRevalidate/);
  assert.match(source, /getNotionWebhookVerificationToken/);
  assert.match(source, /prewarmPublicContentSearchIndex/);
  assert.match(source, /status:\s*401/);
});

test("worker schedules content search prewarm via cron trigger", () => {
  const worker = fs.readFileSync(path.join(root, "worker/index.ts"), "utf8");
  const wrangler = JSON.parse(
    fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8")
  );

  assert.match(worker, /async scheduled/);
  assert.match(worker, /prewarmPublicContentSearchIndex/);
  assert.deepEqual(wrangler.triggers.crons, ["10 18 * * *"]);
});

test("public search routes do not build Notion block indexes in request path", () => {
  const files = [
    "app/api/posts/route.ts",
    "app/api/movies/route.ts",
    "app/blog/page.tsx",
    "app/[locale]/movies/page.tsx",
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /ensureNotion(?:Posts|Movies)SearchIndex/);
  }
});
