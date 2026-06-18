import { spawn } from "node:child_process";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCAFFOLD_TEST_ADMIN_PASSWORD_HASH,
  SCAFFOLD_TEST_ARGS,
  SCAFFOLD_TEST_DIR,
} from "./scaffold-test-config.mjs";
import { applyScaffoldTestCustomizations } from "./scaffold-test-customizations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, SCAFFOLD_TEST_DIR);
const IGNORE = new Set([
  ".DS_Store",
  ".dev.vars",
  "node_modules",
  ".wrangler",
  ".next",
  ".vinext",
]);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function collectFiles(dir, prefix = "") {
  const out = new Map();
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const rel = prefix ? path.join(prefix, entry.name) : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [key, value] of await collectFiles(abs, rel)) {
        out.set(key, value);
      }
      continue;
    }
    let content = await readFile(abs, "utf8");
    if (rel === path.join(".notionx", "registry.json")) {
      content = JSON.stringify(normalizeRegistry(JSON.parse(content)), null, 2);
    }
    if (rel === path.join("migrations", "0002_admin_seed.sql")) {
      content = content.replace(
        /pbkdf2_sha256\$[^']+/g,
        SCAFFOLD_TEST_ADMIN_PASSWORD_HASH,
      );
    }
    out.set(rel, content);
  }
  return out;
}

function normalizeRegistry(registry) {
  return {
    ...registry,
    installed: Array.isArray(registry.installed)
      ? registry.installed.map((item) => {
          const { installedAt: _installedAt, ...rest } = item;
          return rest;
        })
      : registry.installed,
  };
}

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "notionx-scaffold-test-check-"));
  const tempDest = path.join(tempRoot, "scaffold-test");
  const args = SCAFFOLD_TEST_ARGS.map((arg) => (arg === SCAFFOLD_TEST_DIR ? tempDest : arg));

  await run("pnpm", [
    "--filter",
    "@notionx/cli",
    "exec",
    "tsx",
    "src/index.ts",
    ...args,
  ], {
    env: { NOTIONX_PROVISION_DISABLED: "1" },
  });
  await applyScaffoldTestCustomizations(tempDest);

  try {
    await access(APP_DIR);
  } catch {
    await rm(tempRoot, { recursive: true, force: true });
    console.log(
      `${SCAFFOLD_TEST_DIR} is not present; generated scaffold-test successfully.`,
    );
    return;
  }

  const expected = await collectFiles(tempDest);
  const actual = await collectFiles(APP_DIR);
  await rm(tempRoot, { recursive: true, force: true });

  const allPaths = [...new Set([...expected.keys(), ...actual.keys()])].sort();
  for (const rel of allPaths) {
    if (!expected.has(rel)) {
      throw new Error(`apps/scaffold-test drift detected: unexpected file ${rel}. Run \`pnpm scaffold-test:sync\`.`);
    }
    if (!actual.has(rel)) {
      throw new Error(`apps/scaffold-test drift detected: missing file ${rel}. Run \`pnpm scaffold-test:sync\`.`);
    }
    if (expected.get(rel) !== actual.get(rel)) {
      throw new Error(`apps/scaffold-test drift detected: file differs at ${rel}. Run \`pnpm scaffold-test:sync\`.`);
    }
  }

  console.log("apps/scaffold-test is in sync");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
