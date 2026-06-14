#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { loadProjectContext } from "./project-context.js";
import { runProvisionRepair } from "./provision/repair.js";
import { runUpdate, type UpdateSummary } from "./update/index.js";

export function formatUpdateSummary(summary: UpdateSummary): string[] {
  const lines: string[] = [];
  const pushGroup = (label: string, entries: Array<{ filePath: string }>) => {
    if (entries.length === 0) return;
    lines.push(`${label}:`);
    for (const entry of entries) {
      lines.push(`  - ${entry.filePath}`);
    }
  };

  pushGroup("updated", summary.updated);
  pushGroup("missing", summary.missing);
  pushGroup("unchanged", summary.unchanged);
  pushGroup("skipped", summary.skipped);

  if (summary.compatibilityPreserved) {
    lines.push("compatibility:");
    lines.push("  - legacy mode preserved: `nextionSource` left as `workspace:*`");
    lines.push("    (this project predates the scaffolder; the symlink is intentional)");
  }

  if (summary.needsInstall) {
    lines.push("follow-up:");
    lines.push("  - run `pnpm install`");
  }

  return lines;
}

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2);
  const context = await loadProjectContext(process.cwd());

  if (command === "update" && !subcommand) {
    const summary = await runUpdate(context);
    for (const line of formatUpdateSummary(summary)) {
      p.log.info(line);
    }
    return;
  }

  if (command === "provision" && subcommand === "repair") {
    await runProvisionRepair(context);
    return;
  }

  throw new Error(
    `Unsupported command: ${[command, subcommand].filter(Boolean).join(" ")}`
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(message);
    process.exitCode = 1;
  });
}
