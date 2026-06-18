import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNotionCheckError,
  shouldRunAsMain,
  validateBlogSchema,
  validateScaffoldTestNotionEnv,
} from "./scaffold-test-notion-check.mjs";

test("validateScaffoldTestNotionEnv reports missing .dev.vars", () => {
  const result = validateScaffoldTestNotionEnv(null);

  assert.equal(result.ok, false);
  assert.match(result.message, /\.dev\.vars/);
});

test("validateScaffoldTestNotionEnv reports missing NOTION_TOKEN", () => {
  const result = validateScaffoldTestNotionEnv("NOTION_DATA_SOURCE_ID=test-id\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /NOTION_TOKEN/);
});

test("validateScaffoldTestNotionEnv reports missing NOTION_DATA_SOURCE_ID", () => {
  const result = validateScaffoldTestNotionEnv("NOTION_TOKEN=secret\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /NOTION_DATA_SOURCE_ID/);
});

test("validateBlogSchema reports missing Slug", () => {
  const result = validateBlogSchema({
    Name: { title: {} },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["Slug"]);
});

test("formatNotionCheckError surfaces restricted_resource clearly", () => {
  const message = formatNotionCheckError(
    new Error("Notion API error: 403 restricted_resource"),
  );

  assert.match(message, /permission/i);
  assert.match(message, /restricted_resource/);
});

test("validateBlogSchema passes when Name and Slug both exist", () => {
  const result = validateBlogSchema({
    Name: { title: {} },
    Slug: { rich_text: {} },
  });

  assert.deepEqual(result, { ok: true, missing: [] });
});

test("shouldRunAsMain matches the notion check entry script path", () => {
  assert.equal(shouldRunAsMain("scripts/scaffold-test-notion-check.mjs"), true);
  assert.equal(shouldRunAsMain("scripts/scaffold-test-notion-check.test.mjs"), false);
});
