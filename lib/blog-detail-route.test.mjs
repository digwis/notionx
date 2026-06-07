import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const detailPagePath = path.join(projectRoot, "app/blog/[slug]/page.tsx");
const detailLoadingPath = path.join(projectRoot, "app/blog/[slug]/loading.tsx");

test("blog detail page does not render subscribe form entrypoint", () => {
  const source = fs.readFileSync(detailPagePath, "utf8");

  assert.doesNotMatch(source, /SubscribeForm(?:Lazy)?/);
});

test("blog detail page renders Notion blocks instead of D1 paragraph content", () => {
  const source = fs.readFileSync(detailPagePath, "utf8");

  assert.match(source, /NotionBlockRenderer/);
  assert.doesNotMatch(source, /post\.content\.map/);
});

test("blog detail route does not define a dedicated loading skeleton", () => {
  assert.equal(fs.existsSync(detailLoadingPath), false);
});
