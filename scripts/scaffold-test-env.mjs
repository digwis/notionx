import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCAFFOLD_TEST_DIR } from "./scaffold-test-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEV_VARS_PATH = path.join(ROOT, SCAFFOLD_TEST_DIR, ".dev.vars");

export function readEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim() || "";
}

export async function readScaffoldTestDevVars() {
  try {
    return await readFile(DEV_VARS_PATH, "utf8");
  } catch {
    return null;
  }
}

export function validateRequiredEnvKeys(content, required) {
  if (content === null) {
    return {
      ok: false,
      message: "Missing apps/scaffold-test/.dev.vars. Run `pnpm scaffold-test:sync` first.",
    };
  }

  for (const item of required) {
    if (!readEnvValue(content, item.key)) {
      return {
        ok: false,
        message: item.missingMessage,
      };
    }
  }

  return { ok: true };
}
