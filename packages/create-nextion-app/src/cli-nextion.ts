#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import {
  buildDiffSummary,
  formatDiffSummary,
} from "./diff.js";
import { loadRegistry } from "./registry/load-registry.js";
import { installItem } from "./registry/install.js";
import { listOfficialItems } from "./registry/registry-items.js";
import { resolveTemplatesDir } from "./render.js";
import { uninstallItem } from "./registry/uninstall.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, subcommand] = argv;

  if (command === "diff" && !subcommand) {
    const registry = await loadRegistry(process.cwd());
    for (const line of formatDiffSummary(
      buildDiffSummary({ registry })
    )) {
      p.log.info(line);
    }
    return;
  }

  if (command === "diff" && subcommand === "--upgrade") {
    // v2: `nextion update --dry-run` is the canonical preview path.
    // `diff --upgrade` is kept as a thin alias that points users there.
    p.log.info(
      "Use `notionx update --dry-run` to preview pending migrations.",
    );
    p.log.info(
      "(v2 unifies the upgrade preview into `update --dry-run`.)",
    );
    return;
  }

  if (command === "update") {
    // v2 update path. Supports:
    //   notionx update                  — all installed items
    //   notionx update <item-id>        — single item (errors if not installed)
    //   notionx update --core           — report on @notionx/core state (P0 informational; P1 mutates)
    //   notionx update [--dry-run]      — preview only
    //   notionx update --help           — usage
    const updateArgs = argv.slice(1);
    if (updateArgs.includes("--help") || updateArgs.includes("-h")) {
      p.log.info(`Usage: notionx update [<item-id>] [--dry-run] [--core]

Options:
  <item-id>      Update only this installed item (e.g. \`notionx update blog\`).
  --dry-run      Print the plan without writing files.
  --core         Report @notionx/core runtime version state. (v2 P0: informational only.)
  -h, --help     Show this message.`);
      return;
    }

    const dryRun = updateArgs.includes("--dry-run");
    const coreOnly = updateArgs.includes("--core");
    const itemId = updateArgs.find((a) => !a.startsWith("--"));

    if (coreOnly) {
      // v2 P0: --core is informational. P1 will fetch the latest
      // from the npm registry via RegistryClient and bump
      // manifest.nextionCore + package.json atomically.
      const tplDir = await resolveTemplatesDir();
      const { listOfficialItems } = await import("./registry/registry-items.js");
      const { runProjectDoctor } = await import("./registry/doctor.js");
      const report = await runProjectDoctor({
        projectDir: process.cwd(),
        catalogItems: listOfficialItems(),
      });
      const coreCheck = report.checks.find((c) => c.id.startsWith("core."));
      p.log.info(coreCheck ? coreCheck.message : "@notionx/core state could not be determined.");
      if (coreCheck?.hint) p.log.info(`Hint: ${coreCheck.hint}`);
      p.log.info(
        `Run \`notionx doctor\` for the full project diagnostic.`,
      );
      return;
    }

    const tplDir = await resolveTemplatesDir();
    const { listOfficialItems } = await import("./registry/registry-items.js");
    const { applyUpdate } = await import("./registry/update.js");
    const scope = itemId ? { kind: "item" as const, itemId } : { kind: "all" as const };
    let summary;
    try {
      summary = await applyUpdate({
        projectDir: process.cwd(),
        templatesDir: tplDir,
        catalogItems: listOfficialItems(),
        ...(dryRun ? { dryRun: true } : {}),
        scope,
      });
    } catch (err) {
      p.log.error((err as Error).message);
      return;
    }
    const a = summary.plans.additive.length;
    const d = summary.plans.destructive.length;
    const n = summary.plans.noop.length;
    const scopeLabel = itemId ? ` (scoped to "${itemId}")` : "";
    p.log.info(
      `Update plan${scopeLabel}: ${a} additive, ${d} destructive, ${n} already applied.`,
    );
    if (summary.sequence) {
      p.log.info(`Next migration sequence: ${summary.sequence}`);
    }
    for (const f of summary.wroteFiles) {
      p.log.info(`  wrote .nextion/migrations/${f}`);
    }
    for (const f of summary.rerenderedFiles) {
      p.log.info(`  re-rendered ${f}`);
    }
    for (const note of summary.followup) {
      p.log.warn(note);
    }
    if (a + d > 0) {
      p.log.info(
        `Next step: review the migration files, run them, then \`notionx migrate --mark-applied <seq>\`.`,
      );
    }
    return;
  }

  if (command === "doctor") {
    // v2 project-side doctor. Complements (does not replace)
    // `@notionx/core doctor` (which inspects runtime bindings).
    const tplDir = await resolveTemplatesDir();
    const { listOfficialItems } = await import("./registry/registry-items.js");
    const { runProjectDoctor } = await import("./registry/doctor.js");
    const report = await runProjectDoctor({
      projectDir: process.cwd(),
      catalogItems: listOfficialItems(),
    });
    const counts: Record<string, number> = { ok: 0, info: 0, warn: 0, error: 0 };
    for (const check of report.checks) {
      counts[check.severity] = (counts[check.severity] ?? 0) + 1;
      const tag = check.severity.toUpperCase().padEnd(5);
      if (check.severity === "error") p.log.error(`[${tag}] ${check.message}`);
      else if (check.severity === "warn") p.log.warn(`[${tag}] ${check.message}`);
      else p.log.info(`[${tag}] ${check.message}`);
      if (check.hint) p.log.info(`         hint: ${check.hint}`);
    }
    const summary = `${counts.ok} ok, ${counts.info} info, ${counts.warn} warn, ${counts.error} error`;
    if (report.ok) p.log.success(`doctor: ${summary}`);
    else {
      p.log.error(`doctor: ${summary}`);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "pull") {
    // v2.1 feature: reverse-sync from real Notion + D1 state
    // back into .nextion/migrations/. Not implemented yet.
    p.log.info("notionx pull is not yet implemented (planned for v2.1).");
    p.log.info("See docs/architecture/registry-protocol.md#44 for the design.");
    return;
  }

  if (command === "add") {
    // `notionx add <id> [flags...]` — also accepts `notionx add
    // --list` and `notionx add --help` as no-arg invocations.
    // We treat anything starting with `--` as a subcommand
    // flag, not an item id.
    const id = !subcommand || subcommand.startsWith("--") ? undefined : subcommand;
    if (!id || id === "--list") {
      // List installable items from the official catalog, hiding
      // the default scaffold item (`blog`) since it ships with
      // `nextion init` and `add blog` is a no-op.
      const DEFAULT_SCAFFOLD_IDS = new Set(["blog"]);

      // Try to load the project's manifest so we can show
      // installed status. If no project exists, just list
      // everything without status markers.
      let installedIds: Set<string> | null = null;
      try {
        const { loadRegistry } = await import("./registry/load-registry.js");
        const loaded = await loadRegistry(process.cwd());
        installedIds = new Set(loaded.manifest.installed.map((i) => i.id));
      } catch {
        // Not a nextion project, or no registry yet — that's fine.
      }

      const kindLabel: Record<string, string> = {
        "content-source": "content",
        "feature-module": "feature",
        "platform-extension": "platform",
      };

      for (const item of listOfficialItems()) {
        if (DEFAULT_SCAFFOLD_IDS.has(item.id)) continue;
        const status = installedIds?.has(item.id) ? " [installed]" : "";
        const kind = kindLabel[item.kind] ?? item.kind;
        p.log.info(`  ${item.id} (${kind} v${item.version})${status}`);
      }
      if (installedIds === null) {
        p.log.info(
          "\n  Run this inside a nextion project to see install status.",
        );
      }
      return;
    }
    const dryRun = argv.includes("--dry-run");
    const params: Record<string, string> = {};
    for (let i = 2; i < argv.length; i++) {
      const a = argv[i];
      if (!a) continue;
      if (a.startsWith("--param=")) {
        const kv = a.slice("--param=".length);
        const eq = kv.indexOf("=");
        if (eq > 0) params[kv.slice(0, eq)] = kv.slice(eq + 1);
      }
    }
    const tplDir = await resolveTemplatesDir();
    try {
      const summary = await installItem({
        projectDir: process.cwd(),
        templatesDir: tplDir,
        itemId: id,
        ...(dryRun ? { dryRun: true } : {}),
        ...(Object.keys(params).length > 0 ? { params } : {}),
      });
      p.log.info(
        `Installed "${summary.item.id}" (${summary.item.kind} v${summary.item.version}).`,
      );
      for (const f of summary.files) {
        const action = f.existed ? "updated" : "created";
        p.log.info(`  ${action} ${f.projectRelativePath}`);
      }
      if (summary.rerenderedModels) {
        p.log.info(`  updated lib/content/models.ts`);
      }
      for (const note of summary.followup) {
        p.log.warn(note);
      }
    } catch (err) {
      p.log.error((err as Error).message);
    }
    return;
  }

  if (command === "remove") {
    const id = argv.slice(1).find((a) => !a.startsWith("--"));
    if (!id) {
      p.log.error("Usage: notionx remove <id> [--dry-run] [--purge]");
      return;
    }
    const dryRun = argv.includes("--dry-run");
    const purge = argv.includes("--purge");
    const tplDir = await resolveTemplatesDir();
    try {
      const summary = await uninstallItem({
        projectDir: process.cwd(),
        templatesDir: tplDir,
        itemId: id,
        ...(dryRun ? { dryRun: true } : {}),
        ...(purge ? { purge: true } : {}),
      });
      p.log.info(
        `Removed "${summary.removedItem.id}".`,
      );
      if (summary.rerenderedModels) {
        p.log.info(`  updated lib/content/models.ts`);
      }
      for (const f of summary.deletedFiles) {
        p.log.info(`  deleted ${f}`);
      }
      for (const note of summary.followup) {
        p.log.warn(note);
      }
    } catch (err) {
      p.log.error((err as Error).message);
    }
    return;
  }

  if (command === "migrate" && subcommand === "--mark-applied") {
    const seq = argv[2];
    if (!seq) {
      p.log.error("Usage: notionx migrate --mark-applied <sequence>");
      return;
    }
    const { markMigrationApplied } = await import(
      "./registry/migrations-store.js"
    );
    const { writeRegistryManifest } = await import(
      "./registry/registry-store.js"
    );
    const next = await markMigrationApplied(process.cwd(), seq);
    p.log.info(
      `Marked migration ${seq} as applied. (${next.history.filter((h) => h.applied).length}/${next.history.length} applied.)`,
    );

    // Bump the installed item's version in registry.json so the
    // next `nextion update` doesn't re-emit the same migration.
    // The migration entry's label follows the convention
    // `<itemId> <fromV>-><toV>` (e.g. "blog 1->2").
    const entry = next.history.find((h) => h.sequence === seq);
    if (entry?.label) {
      const match = entry.label.match(/^(.+)\s+(\d+)->(\d+)$/);
      if (match) {
        const [, itemId, , toV] = match;
        if (itemId && toV) {
          const registry = await loadRegistry(process.cwd());
          const targetVersion = parseInt(toV, 10);
          const hasBump = registry.manifest.installed.some(
            (i) => i.id === itemId && i.version >= targetVersion,
          );
          if (!hasBump) {
            const updatedManifest = {
              ...registry.manifest,
              installed: registry.manifest.installed.map((i) =>
                i.id === itemId
                  ? { ...i, version: targetVersion }
                  : i,
              ),
            };
            await writeRegistryManifest(process.cwd(), updatedManifest);
            p.log.info(
              `Bumped "${itemId}" to version ${targetVersion} in registry.json.`,
            );
          }
        }
      }
    }
    return;
  }

  // Friendly help when the user runs `notionx` with no args or an
  // unknown command. We avoid throwing so the exit code stays 0
  // (clack's `p.log` prints to stderr by convention but we
  // don't want a stack trace here).
  p.log.info(`notionx — v2 registry protocol CLI

Usage:
  notionx add <id> [--dry-run] [--param=k=v ...]
  notionx remove <id> [--dry-run] [--purge]
  notionx update [<item-id>] [--dry-run] [--core]
  notionx migrate --mark-applied <sequence>
  notionx diff
  notionx doctor
  notionx pull                         (planned v2.1)`);
  if (command) {
    p.log.error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
    process.exitCode = 1;
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(message);
    process.exitCode = 1;
  });
}
