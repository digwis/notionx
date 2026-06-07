import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const adminNewPagePath = path.join(projectRoot, "app/admin/new/page.tsx");
const adminEditPagePath = path.join(projectRoot, "app/admin/[slug]/edit/page.tsx");

test("admin new page no longer renders the D1 new post form", () => {
  const source = fs.readFileSync(adminNewPagePath, "utf8");

  assert.doesNotMatch(source, /NewPostFormLazy/);
  assert.match(source, /AdminNotionPostCard/);
});

test("admin edit page no longer renders the D1 edit post form", () => {
  const source = fs.readFileSync(adminEditPagePath, "utf8");

  assert.doesNotMatch(source, /EditPostFormLazy/);
  assert.match(source, /AdminNotionPostCard/);
});
