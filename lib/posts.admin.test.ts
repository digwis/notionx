import test from "node:test";
import assert from "node:assert/strict";
import { getAdminListColumns } from "./admin-post-list.ts";

test("getAdminListColumns excludes content for admin dashboard list", () => {
  const columns = getAdminListColumns();

  assert.ok(columns.includes("slug"));
  assert.ok(columns.includes("title"));
  assert.ok(columns.includes("cover_image"));
  assert.ok(!columns.includes("content"));
});
