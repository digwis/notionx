#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { loadProjectContext } from "./project-context.js";
import { inspectProvisionRepair } from "./provision/inspect.js";
import { buildUpdatePlan } from "./update/template-sync.js";
import {
  formatUnifiedUpdateSummary,
  runUnifiedUpdate,
} from "./update/unified.js";
import type { UpdateSummary } from "./update/index.js";

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

function formatInstalledTemplates(
  templates: Array<{ name: string; version: number }>
): string[] {
  if (templates.length === 0) return [];
  return [
    "templates:",
    ...templates.map((template) => `  - ${template.name}@${template.version}`),
  ];
}

async function chooseConflictStrategy(conflictCount: number) {
  if (conflictCount === 0) {
    return "safe-only" as const;
  }

  return (await p.select({
    message: `Found ${conflictCount} conflicts. How should update proceed?`,
    options: [
      { value: "apply-all", label: "Apply all conflict updates" },
      { value: "safe-only", label: "Apply only safe updates" },
      { value: "cancel", label: "Cancel" },
    ],
  })) as "apply-all" | "safe-only" | "cancel";
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, subcommand] = argv;

  if (command === "update" && !subcommand) {
    const context = await loadProjectContext(process.cwd());
    for (const line of formatInstalledTemplates(
      context.installations.templates
    )) {
      p.log.info(line);
    }
    const [templateEntries, repairEntries] = await Promise.all([
      buildUpdatePlan(context),
      inspectProvisionRepair(context),
    ]);
    const conflictCount =
      templateEntries.filter((entry) => entry.status === "updated").length +
      repairEntries.filter((entry) => entry.risk === "conflict").length;
    const conflictChoice = await chooseConflictStrategy(conflictCount);

    if (conflictChoice === "cancel") {
      return;
    }

    const summary = await runUnifiedUpdate(context, {
      templateEntries,
      repairEntries,
      conflictChoice,
    });
    for (const line of formatUnifiedUpdateSummary(summary)) {
      p.log.info(line);
    }
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
