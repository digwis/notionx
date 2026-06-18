import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCAFFOLD_TEST_DIR } from "./scaffold-test-config.mjs";
import {
  readScaffoldTestDevVars,
  validateRequiredEnvKeys,
} from "./scaffold-test-env.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ENTRY_BASENAME = "scaffold-test-dev.mjs";

export function validateScaffoldTestDevEnv(content) {
  return validateRequiredEnvKeys(content, [
    {
      key: "NOTION_TOKEN",
      missingMessage:
        "Missing NOTION_TOKEN in apps/scaffold-test/.dev.vars. Add your Notion integration token before starting dev.",
    },
    {
      key: "NOTION_DATA_SOURCE_ID",
      missingMessage:
        "Missing NOTION_DATA_SOURCE_ID in apps/scaffold-test/.dev.vars. Re-run `pnpm scaffold-test:sync` or fill it manually.",
    },
  ]);
}

export function shouldRunAsMain(argv1) {
  return typeof argv1 === "string" && path.basename(argv1) === ENTRY_BASENAME;
}

function runScaffoldTestDev() {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--dir", SCAFFOLD_TEST_DIR, "dev"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pnpm --dir ${SCAFFOLD_TEST_DIR} dev exited with code ${code}`));
    });
  });
}

async function main() {
  const content = await readScaffoldTestDevVars();
  const validation = validateScaffoldTestDevEnv(content);
  if (!validation.ok) {
    console.error(validation.message);
    process.exit(1);
  }

  await runScaffoldTestDev();
}

if (shouldRunAsMain(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
