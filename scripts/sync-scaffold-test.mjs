import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCAFFOLD_TEST_ADMIN_PASSWORD_HASH,
  SCAFFOLD_TEST_ARGS,
  SCAFFOLD_TEST_DIR,
} from "./scaffold-test-config.mjs";
import {
  applyScaffoldTestCustomizations,
  buildInitialScaffoldTestDevVars,
} from "./scaffold-test-customizations.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEST = path.join(ROOT, SCAFFOLD_TEST_DIR);
const KEEP = [".dev.vars"];

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

async function readPreservedFiles() {
  const preserved = new Map();
  for (const file of KEEP) {
    const abs = path.join(DEST, file);
    try {
      preserved.set(file, await readFile(abs));
    } catch {
      // Local-only file absent is fine.
    }
  }
  return preserved;
}

async function restorePreservedFiles(preserved) {
  for (const [file, contents] of preserved) {
    await writeFile(path.join(DEST, file), contents);
  }
}

async function ensureInitialDevVars(preserved) {
  if (preserved.has(".dev.vars")) {
    return;
  }
  const examplePath = path.join(DEST, ".dev.vars.example");
  const devVarsPath = path.join(DEST, ".dev.vars");
  const example = await readFile(examplePath, "utf8");
  await writeFile(devVarsPath, buildInitialScaffoldTestDevVars(example), "utf8");
}

async function normalizeGeneratedFiles() {
  const adminSeedPath = path.join(DEST, "migrations", "0002_admin_seed.sql");
  try {
    const sql = await readFile(adminSeedPath, "utf8");
    await writeFile(
      adminSeedPath,
      sql.replace(
        /pbkdf2_sha256\$[^']+/g,
        SCAFFOLD_TEST_ADMIN_PASSWORD_HASH,
      ),
    );
  } catch {
    // If the admin seed migration is absent, leave the generated app as-is.
  }
}

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "notionx-scaffold-test-"));
  const tempDest = path.join(tempRoot, "scaffold-test");
  const args = SCAFFOLD_TEST_ARGS.map((arg) => (arg === SCAFFOLD_TEST_DIR ? tempDest : arg));
  const preserved = await readPreservedFiles();

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

  await rm(DEST, { recursive: true, force: true });
  await mkdir(path.dirname(DEST), { recursive: true });
  await cp(tempDest, DEST, { recursive: true });
  await normalizeGeneratedFiles();
  await applyScaffoldTestCustomizations(DEST);
  await ensureInitialDevVars(preserved);
  await restorePreservedFiles(preserved);
  await rm(tempRoot, { recursive: true, force: true });

  console.log(`Synced ${SCAFFOLD_TEST_DIR}`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
