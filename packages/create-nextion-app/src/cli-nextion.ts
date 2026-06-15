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

  if (command === "locale" && subcommand === "add") {
    const localeArg = argv[2];
    if (!localeArg) {
      throw new Error(
        "Usage: nextion locale add <locale> [--apply] [--with-notion] [--copy-from <locale>]"
      );
    }
    const tail = argv.slice(3);
    const withNotion = tail.includes("--with-notion");
    const apply = tail.includes("--apply");
    const copyFromIdx = tail.indexOf("--copy-from");
    const copyFrom = copyFromIdx >= 0 ? tail[copyFromIdx + 1] : undefined;

    const { validateLocaleAdd } = await import("./locale-add/validate.js");
    const { buildLocaleAddPlan } = await import("./locale-add/plan.js");
    const { runLocaleAddPlan } = await import("./locale-add/apply.js");
    const {
      logLocaleAddDryRun,
      logLocaleAddSummary,
    } = await import("./locale-add/format.js");

    const context = await loadProjectContext(process.cwd());
    const validation = validateLocaleAdd({
      locale: localeArg,
      supportedLocales: context.metadata.supportedLocales,
      defaultLocale: context.metadata.defaultLocale,
    });
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const plan = buildLocaleAddPlan({
      projectDir: context.projectDir,
      metadata: context.metadata,
      locale: validation.locale,
      withNotion,
      copyFrom,
    });
    logLocaleAddDryRun(plan);

    if (!apply) {
      p.log.info("re-run with --apply to write the changes.");
      return;
    }

    const summary = await runLocaleAddPlan(plan);
    logLocaleAddSummary(summary);
    return;
  }

  if (command === "locale" && subcommand === "list") {
    const { loadProjectContext } = await import("./project-context.js");
    const { buildLocaleListView } = await import("./locale-add/list.js");
    const context = await loadProjectContext(process.cwd());
    const view = buildLocaleListView({ metadata: context.metadata });
    p.log.info(`default locale: ${context.metadata.defaultLocale}`);
    for (const row of view.rows) {
      const tag = row.isDefault ? " (default)" : "";
      p.log.info(`  - ${row.locale}${tag}`);
      for (const ts of row.translationSources) {
        const mark = ts.configured ? "✓" : "·";
        p.log.info(`      [${mark}] ${ts.modelId} → ${ts.envVar}`);
      }
    }
    return;
  }

  if (command === "locale" && !subcommand) {
    p.log.info("Usage: npx nextion locale <add|list> ...");
    p.log.info("  add <locale> [--apply] [--with-notion] [--copy-from <locale>]");
    p.log.info("  list");
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
