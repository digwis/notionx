#!/usr/bin/env node
// packages/create-nextion-app/scripts/copy-templates.mjs
//
// Copies the `src/templates/` tree into `dist/templates/` after the
// TypeScript build. The compiled `dist/index.js` looks for templates
// under `dist/templates` first, then falls back to `src/templates` when
// the package is run from source via `tsx`. This script is the
// canonical way to keep the two in sync for compiled runs.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SRC = path.join(PACKAGE_ROOT, "src", "templates");
const DEST = path.join(PACKAGE_ROOT, "dist", "templates");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

async function main() {
  await fs.rm(DEST, { recursive: true, force: true });
  await copyDir(SRC, DEST);
  console.log(`Copied templates → ${path.relative(PACKAGE_ROOT, DEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
