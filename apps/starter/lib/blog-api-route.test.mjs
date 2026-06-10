import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

test("blog detail API sanitizes Notion media blocks before returning JSON", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "app/api/posts/[slug]/route.ts"),
    "utf8"
  );

  assert.match(source, /publicMediaBlockForApi/);
  assert.match(source, /post\.blocks\.map\(publicMediaBlockForApi\)/);
  assert.match(source, /revalidate\s*=\s*60/);
  assert.doesNotMatch(source, /force-dynamic/);
});

test("blog list API participates in vinext CDN caching", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "app/api/posts/route.ts"),
    "utf8"
  );

  assert.match(source, /revalidate\s*=\s*60/);
  assert.match(source, /publicJsonHeadersForListRequest/);
  assert.doesNotMatch(source, /force-dynamic/);
});

test("blog admin actions revalidate detail JSON API paths", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "lib/actions.ts"),
    "utf8"
  );

  assert.match(source, /revalidateBlogPostPublicPaths/);
  assert.match(source, /revalidatePath\(`\/api\/posts\/\$\{slug\}`\)/);
});
