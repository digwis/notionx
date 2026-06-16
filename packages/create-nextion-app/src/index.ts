#!/usr/bin/env node
// packages/create-nextion-app/src/index.ts
//
// CLI entry point. Runs the interactive prompt, then renders the
// generated project into the target directory and prints next-step
// instructions. Designed to run from source via `tsx` (dev) or from
// the compiled `dist/index.js` (when installed as a workspace bin).

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { gatherAnswers, type ExtendedAnswers } from "./answers.js";
import { render } from "./render.js";
import { provision } from "./provision/index.js";

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

    // Post-render provisioning. We treat this as a separate
    // interactive stage: it talks to wrangler / ntn / Cloudflare /
    // Notion, all of which can be slow or hang on auth. In --yes /
    // non-TTY mode we still try — every step is wrapped in its own
    // try/catch and best-effort, so the worst case is a status card
    // that says "Deploy skipped" and instructions to retry.
    // Set NOTIONX_PROVISION_DISABLED=1 to skip entirely.
    const projectDir = path.resolve(process.cwd(), answers.targetDir);
    const provisioningEnabled = !process.env.NOTIONX_PROVISION_DISABLED;
    if (provisioningEnabled) {
      try {
        // `interactive: true` is only safe when stdin is a real TTY.
        // When the scaffolder is piped (e.g. `pnpm create … | tee log`,
        // CI, or a non-interactive `node dist/index.js --yes` run from
        // a script), @clack/prompts throws Node's
        // `ERR_TTY_INIT_FAILED` ("TTY initialization failed: uv_tty_init
        // returned EINVAL") the moment any prompt tries to read input.
        // Detect that case and switch to silent mode so the rest of
        // provisioning still runs.
        const interactive = Boolean(process.stdin.isTTY);
        await provision(answers, projectDir, { interactive });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        p.log.warn(`Provisioning error: ${message}`);
      }
    } else {
      p.log.info(
        "Provisioning disabled (NOTIONX_PROVISION_DISABLED=1). Run \`pnpm dev\` to start; see README for manual setup."
      );
    }

    // Print the auto-generated admin password once, ONLY if we
    // generated it (i.e. the user did not supply one). This is the
    // only time the plaintext appears — it's not in the generated
    // project files, only its hash in the D1 migration.
    const generated = (answers as ExtendedAnswers)._generatedAdminPassword;
    if (generated) {
      console.log("");
      p.log.warn(
        [
          "Auto-generated admin credentials (NOT stored anywhere on disk — save these now):",
          `  Admin email   : ${answers.adminEmail}`,
          `  Admin password: ${generated}`,
          `  Login at      : ${answers.targetDir}/login`,
        ].join("\n")
      );
    }

    p.outro("✨ Project generated!");
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${answers.targetDir}`);
    console.log("  pnpm dev");
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
