#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["lib"];
const PATTERN = /\.test\.(?:ts|mjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".vinext", ".wrangler", "dist"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (PATTERN.test(entry)) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r))).sort();
if (files.length === 0) {
  console.error("No test files found under", ROOTS.join(", "));
  process.exit(1);
}

const rel = files.map((f) => relative(ROOT, f));
const extraArgs = process.argv.slice(2);
const child = spawn(
  process.execPath,
  ["--test", "--test-reporter=spec", ...rel, ...extraArgs],
  { stdio: "inherit" }
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
