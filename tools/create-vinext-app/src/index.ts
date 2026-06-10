#!/usr/bin/env node
// tools/create-vinext-app/src/index.ts
//
// CLI entry point. Runs the interactive prompt, then renders the
// generated project into the target directory and prints next-step
// instructions. Designed to run from source via `tsx` (dev) or from
// the compiled `dist/index.js` (when installed as a workspace bin).

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { gatherAnswers } from "./answers.js";
import { render } from "./render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  try {
    const answers = await gatherAnswers(process.argv);

    // Resolve templates dir: prefer `dist/templates` when the package
    // is compiled, fall back to `src/templates` when running from
    // source via `tsx`.
    const compiled = path.resolve(__dirname, "templates");
    const fromSource = path.resolve(__dirname, "..", "src", "templates");
    const templatesDir = (await existsDir(compiled)) ? compiled : fromSource;

    p.log.info(`Rendering into ${answers.targetDir}…`);
    await render(answers, templatesDir, answers.targetDir);

    p.outro("✨ Project generated!");
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${answers.targetDir}`);
    console.log("  pnpm install");
    console.log("  cp .dev.vars.example .dev.vars");
    console.log("  pnpm test");
    console.log("  pnpm dev");
    console.log("");
    console.log("To deploy to Cloudflare:");
    console.log("  pnpm exec wrangler d1 migrations apply <db-name> --remote");
    console.log("  pnpm exec vinext deploy");
  } catch (err) {
    if (err instanceof Error && err.message === "cancelled") {
      process.exit(0);
    }
    if (err instanceof Error && err.message === "non-interactive without flags") {
      process.exit(2);
    }
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(message);
    process.exit(1);
  }
}

async function existsDir(p: string): Promise<boolean> {
  try {
    const stat = await import("node:fs/promises").then((m) => m.stat(p));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

main();
