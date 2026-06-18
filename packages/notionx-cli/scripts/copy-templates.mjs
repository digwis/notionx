#!/usr/bin/env node
// packages/notionx-cli/scripts/copy-templates.mjs
//
// Copies the `src/templates/` tree into `dist/templates/` after the
// TypeScript build so compiled runs can resolve `dist/templates/blog`
// (and future named starters) the same way source runs resolve
// `src/templates/blog`. This script is the canonical way to keep the
// source and compiled template trees in sync.

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
