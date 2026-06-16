import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { planPublications } from "./publish-packages.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");

test("release workflow pushes the version bump before publishing", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const pushIndex = workflow.indexOf("- name: Commit + push version bump");
  const publishIndex = workflow.indexOf("- name: Publish packages");

  assert.notEqual(pushIndex, -1, "expected a version bump push step");
  assert.notEqual(publishIndex, -1, "expected a publish step");
  assert.ok(
    pushIndex < publishIndex,
    "expected the workflow to push the version bump before publishing packages"
  );
});

test("planPublications skips versions that are already on npm", () => {
  const packages = [
    {
      name: "@notionx/create-notionx-app",
      version: "0.6.0",
      directory: "packages/create-nextion-app",
    },
    {
      name: "@notionx/core",
      version: "1.1.0",
      directory: "packages/nextion",
    },
  ];

  const plan = planPublications(
    packages,
    new Set(["@notionx/create-notionx-app@0.6.0"])
  );

  assert.deepEqual(plan, {
    alreadyPublished: [packages[0]],
    toPublish: [packages[1]],
  });
});
