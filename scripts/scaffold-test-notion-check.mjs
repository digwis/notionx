import path from "node:path";

import { runOrThrowNtn } from "../packages/notionx-cli/dist/provision/shell.js";
import {
  SCAFFOLD_TEST_NOTION_REQUIRED_FIELDS,
} from "./scaffold-test-config.mjs";
import {
  readEnvValue,
  readScaffoldTestDevVars,
  validateRequiredEnvKeys,
} from "./scaffold-test-env.mjs";

const ENTRY_BASENAME = "scaffold-test-notion-check.mjs";

export function validateBlogSchema(properties) {
  const missing = SCAFFOLD_TEST_NOTION_REQUIRED_FIELDS.filter((name) => !properties[name]);
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
}

export function validateScaffoldTestNotionEnv(content) {
  return validateRequiredEnvKeys(content, [
    {
      key: "NOTION_TOKEN",
      missingMessage:
        "Missing NOTION_TOKEN in apps/scaffold-test/.dev.vars. Add your Notion integration token before running `pnpm scaffold-test:notion:check`.",
    },
    {
      key: "NOTION_DATA_SOURCE_ID",
      missingMessage:
        "Missing NOTION_DATA_SOURCE_ID in apps/scaffold-test/.dev.vars. Re-run `pnpm scaffold-test:sync` or fill it manually.",
    },
  ]);
}

export async function fetchDataSourceSchema({ token, dataSourceId }) {
  const stdout = await runOrThrowNtn(["api", `v1/data_sources/${dataSourceId}`], {
    env: { NOTION_API_TOKEN: token },
  });
  const raw = JSON.parse(stdout);
  return raw.properties ?? {};
}

export function formatNotionCheckError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/restricted_resource|403/i.test(message)) {
    return `Notion schema check failed: the configured token does not have permission to access the fixed test resource. Raw error: ${message}`;
  }
  return `Notion schema check failed: ${message}`;
}

export function shouldRunAsMain(argv1) {
  return typeof argv1 === "string" && path.basename(argv1) === ENTRY_BASENAME;
}

async function main() {
  const content = await readScaffoldTestDevVars();
  const validation = validateScaffoldTestNotionEnv(content);
  if (!validation.ok) {
    console.error(validation.message);
    process.exit(1);
  }

  const token = readEnvValue(content, "NOTION_TOKEN");
  const dataSourceId = readEnvValue(content, "NOTION_DATA_SOURCE_ID");
  const properties = await fetchDataSourceSchema({ token, dataSourceId });
  const schema = validateBlogSchema(properties);

  if (!schema.ok) {
    console.error(
      `Notion schema check failed for ${dataSourceId}. Missing fields: ${schema.missing.join(", ")}.`,
    );
    process.exit(1);
  }

  console.log(`Notion schema check passed for ${dataSourceId}.`);
}

if (shouldRunAsMain(process.argv[1])) {
  main().catch((error) => {
    console.error(formatNotionCheckError(error));
    process.exit(1);
  });
}
