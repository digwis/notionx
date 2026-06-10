import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(currentDir, "..", "..");
const packageRoot = path.resolve(root, "..", "..", "packages", "foundation");

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
  // The prewarm route moved into the package; the starter re-exports
  // its handler. The factory itself authorizes the request and
  // returns 401 when no valid token is supplied. The starter wires
  // `getNotionWebhookVerificationToken` (from `@vinext/foundation/notion/config`)
  // into the factory's `getVerificationToken` slot.
  const factory = fs.readFileSync(
    path.join(packageRoot, "src/worker/routes/content-prewarm.ts"),
    "utf8"
  );
  const tokenResolver = fs.readFileSync(
    path.join(packageRoot, "src/notion/config.ts"),
    "utf8"
  );
  const starterRoute = fs.readFileSync(
    path.join(root, "app/api/content/prewarm/route.ts"),
    "utf8"
  );

  // The factory is the one that returns 401 when authorization fails.
  assert.match(factory, /authorizeContentRevalidate/);
  assert.match(factory, /status:\s*401/);
  // The factory receives a `getVerificationToken` injection; the
  // starter wires the package's Notion token resolver into it.
  assert.match(factory, /getVerificationToken/);
  assert.match(tokenResolver, /getNotionWebhookVerificationToken/);
  assert.match(starterRoute, /getNotionWebhookVerificationToken/);
  assert.match(starterRoute, /prewarmPublicContentSearchIndex/);
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
