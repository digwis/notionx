import test from "node:test";
import assert from "node:assert/strict";

import {
  applyScaffoldTestCustomizationsToText,
  buildInitialScaffoldTestDevVars,
  SCAFFOLD_TEST_CUSTOM_README_MARKER,
} from "./scaffold-test-customizations.mjs";
import { SCAFFOLD_TEST_NOTION_RESOURCE_ID } from "./scaffold-test-config.mjs";

test("injects the fixed Notion resource id into apps/scaffold-test .dev.vars.example", () => {
  const original = "NOTION_DATA_SOURCE_ID=\n";

  const customized = applyScaffoldTestCustomizationsToText(
    ".dev.vars.example",
    original,
  );

  assert.match(customized, new RegExp(SCAFFOLD_TEST_NOTION_RESOURCE_ID));
  assert.match(customized, /NOTION_DATA_SOURCE_ID=/);
});

test("injects a dedicated scaffold test note into apps/scaffold-test README", () => {
  const original = "# scaffold-test\n\n## Quick start\n";

  const customized = applyScaffoldTestCustomizationsToText("README.md", original);

  assert.match(customized, new RegExp(SCAFFOLD_TEST_CUSTOM_README_MARKER));
  assert.match(customized, new RegExp(SCAFFOLD_TEST_NOTION_RESOURCE_ID));
});

test("builds an initial apps/scaffold-test .dev.vars with the fixed Notion resource id", () => {
  const example = [
    "NOTION_TOKEN=",
    "NOTION_DATA_SOURCE_ID=",
    "NOTION_PAGES_DATA_SOURCE_ID=",
    "",
  ].join("\n");

  const devVars = buildInitialScaffoldTestDevVars(example);

  assert.match(
    devVars,
    new RegExp(`NOTION_DATA_SOURCE_ID=${SCAFFOLD_TEST_NOTION_RESOURCE_ID}`),
  );
  assert.match(devVars, /NOTION_TOKEN=$/m);
  assert.match(devVars, /NOTION_PAGES_DATA_SOURCE_ID=$/m);
});
