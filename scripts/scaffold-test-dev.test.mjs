import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldRunAsMain,
  validateScaffoldTestDevEnv,
} from "./scaffold-test-dev.mjs";
import { readEnvValue, validateRequiredEnvKeys } from "./scaffold-test-env.mjs";

test("readEnvValue reads a simple key from .dev.vars content", () => {
  const value = readEnvValue(
    "NOTION_TOKEN=secret\nNOTION_DATA_SOURCE_ID=test-id\n",
    "NOTION_DATA_SOURCE_ID",
  );

  assert.equal(value, "test-id");
});

test("validateRequiredEnvKeys reports the first missing key", () => {
  const result = validateRequiredEnvKeys("NOTION_TOKEN=secret\n", [
    {
      key: "NOTION_TOKEN",
      missingMessage: "Missing NOTION_TOKEN in apps/scaffold-test/.dev.vars.",
    },
    {
      key: "NOTION_DATA_SOURCE_ID",
      missingMessage: "Missing NOTION_DATA_SOURCE_ID in apps/scaffold-test/.dev.vars.",
    },
  ]);

  assert.equal(result.ok, false);
  assert.match(result.message, /NOTION_DATA_SOURCE_ID/);
});

test("validateScaffoldTestDevEnv reports missing .dev.vars", () => {
  const result = validateScaffoldTestDevEnv(null);

  assert.equal(result.ok, false);
  assert.match(result.message, /\.dev\.vars/);
});

test("validateScaffoldTestDevEnv reports missing NOTION_TOKEN", () => {
  const result = validateScaffoldTestDevEnv("NOTION_DATA_SOURCE_ID=test-id\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /NOTION_TOKEN/);
});

test("validateScaffoldTestDevEnv reports missing NOTION_DATA_SOURCE_ID", () => {
  const result = validateScaffoldTestDevEnv("NOTION_TOKEN=secret\n");

  assert.equal(result.ok, false);
  assert.match(result.message, /NOTION_DATA_SOURCE_ID/);
});

test("validateScaffoldTestDevEnv passes when both required keys exist", () => {
  const result = validateScaffoldTestDevEnv(
    "NOTION_TOKEN=secret\nNOTION_DATA_SOURCE_ID=test-id\n",
  );

  assert.deepEqual(result, { ok: true });
});

test("shouldRunAsMain matches the dev entry script path", () => {
  assert.equal(shouldRunAsMain("scripts/scaffold-test-dev.mjs"), true);
  assert.equal(shouldRunAsMain("scripts/scaffold-test-dev.test.mjs"), false);
});
