#!/usr/bin/env node

// Shim entry for `npm create notionx` / `npx create-notionx`.
//
// This package is intentionally dependency-free: it delegates to
// `@notionx/cli@latest` via `npx --yes` so every
// invocation pulls the newest published scaffold. This avoids the
// stale-npx-cache problem where `npx create-notionx` reuses a
// cached (possibly outdated) `@notionx/cli`.

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const result = spawnSync(
  "npx",
  ["--yes", "--package", "@notionx/cli@latest", "create-notionx", ...args],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  }
);

process.exit(result.status ?? 1);
