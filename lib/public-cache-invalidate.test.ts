import test from "node:test";
import assert from "node:assert/strict";
import { buildInvalidationPlan } from "./public-cache-invalidate.ts";

test("buildInvalidationPlan for publish covers list and detail", () => {
  const plan = buildInvalidationPlan({ slug: "hello-world", kind: "publish" });
  assert.equal(plan.kind, "publish");
  assert.deepEqual(plan.keys, [
    "https://cache.local/blog",
    "https://cache.local/blog/hello-world",
  ]);
});

test("buildInvalidationPlan for update covers list and detail", () => {
  const plan = buildInvalidationPlan({ slug: "hello-world", kind: "update" });
  assert.equal(plan.kind, "update");
  assert.equal(plan.keys.length, 2);
});

test("buildInvalidationPlan with previous slug covers old and new", () => {
  const plan = buildInvalidationPlan({
    slug: "new",
    previousSlug: "old",
    kind: "publish",
  });
  assert.equal(plan.keys.length, 3);
  assert.ok(plan.keys.includes("https://cache.local/blog/old"));
  assert.ok(plan.keys.includes("https://cache.local/blog/new"));
});

test("buildInvalidationPlan for delete covers list and detail", () => {
  const plan = buildInvalidationPlan({ slug: "gone", kind: "delete" });
  assert.equal(plan.kind, "delete");
  assert.deepEqual(plan.keys, [
    "https://cache.local/blog",
    "https://cache.local/blog/gone",
  ]);
});
