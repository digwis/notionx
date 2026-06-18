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
import { resolveStarterTemplatesDir } from "./render.js";
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

  if (command === "locale" && subcommand === "add") {
    const localeArg = argv[2];
    if (!localeArg) {
      throw new Error(
        "Usage: notionx locale add <locale> [--apply] [--with-notion] [--copy-from <locale>]"
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
    const { resolveNotionCredentials } = await import(
      "./provision/credentials.js"
    );

    const registry = await loadRegistry(process.cwd());
    const validation = validateLocaleAdd({
      locale: localeArg,
      supportedLocales: registry.manifest.supportedLocales,
      defaultLocale: registry.manifest.defaultLocale,
    });
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    let notionApiToken: string | undefined;
    let notionParentPageId: string | undefined;
    if (withNotion) {
      const creds = await resolveNotionCredentials({ nonInteractive: false });
      if (creds) {
        notionApiToken = creds.apiToken;
        notionParentPageId = creds.parentPageId;
      } else {
        p.log.warn(
          "Could not resolve Notion credentials. Translation sources will not be created.",
        );
      }
    }

    const plan = await buildLocaleAddPlan({
      projectDir: process.cwd(),
      // `RegistryManifest` (v2) is a superset of `ScaffoldMetadata`
      // (v1) for the fields `buildLocaleAddPlan` actually reads
      // (supportedLocales, defaultLocale, translationSources).
      // Cast through `unknown` to bridge the structural gap.
      metadata: registry.manifest as unknown as import("./metadata.js").ScaffoldMetadata,
      locale: validation.locale,
      withNotion,
      copyFrom,
      notionApiToken,
      notionParentPageId,
    });
    logLocaleAddDryRun(plan);

    if (!apply) {
      p.log.info("re-run with --apply to write the changes.");
      return;
    }

    const summary = await runLocaleAddPlan(plan);
    logLocaleAddSummary(summary);

    // Persist created translation source ids to registry.json so
    // future `locale add` / `notionx update` / `notionx doctor` can
    // find and reuse them. Also patch wrangler.jsonc and .dev.vars
    // so the worker can bind to them at runtime.
    if (Object.keys(summary.translationSourceIds).length > 0) {
      const {
        persistTranslationSourcesToRegistry,
        updateEnvFilesForTranslationSources,
      } = await import("./locale-add/persist.js");
      await persistTranslationSourcesToRegistry(
        process.cwd(),
        summary.translationSourceIds,
      );
      await updateEnvFilesForTranslationSources(
        process.cwd(),
        summary.translationSourceIds,
      );
    }

    return;
  }

  if (command === "locale" && subcommand === "list") {
    const { buildLocaleListView } = await import("./locale-add/list.js");
    const registry = await loadRegistry(process.cwd());
    const view = buildLocaleListView({
      metadata: registry.manifest as unknown as import("./metadata.js").ScaffoldMetadata,
    });
    p.log.info(`default locale: ${registry.manifest.defaultLocale}`);
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

  if (command === "diff" && subcommand === "--upgrade") {
    // v2: `notionx update --dry-run` is the canonical preview path.
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
    //   notionx update --core           — update @notionx/core package metadata
    //   notionx update --core --to <v>  — pin the core metadata to an explicit spec
    //   notionx update [--dry-run]      — preview only
    //   notionx update --help           — usage
    const updateArgs = argv.slice(1);
    if (updateArgs.includes("--help") || updateArgs.includes("-h")) {
      p.log.info(`Usage: notionx update [<item-id>] [--dry-run] [--core] [--target latest|next] [--to <version-or-range>]

Options:
  <item-id>      Update only this installed item (e.g. \`notionx update blog\`).
  --dry-run      Print the plan without writing files.
  --core         Update @notionx/core package metadata and .notionx/registry.json.
  --target       Resolve @notionx/core from an npm dist-tag (latest or next). Default: latest.
  --to           Use an explicit @notionx/core version/range (e.g. 3.2.0, ^3.2.0, workspace:*).
  -h, --help     Show this message.`);
      return;
    }

    const dryRun = updateArgs.includes("--dry-run");
    const coreOnly = updateArgs.includes("--core");
    let explicitCoreTarget: ReturnType<typeof parseCoreUpdateTarget>;
    let itemId: string | undefined;
    try {
      explicitCoreTarget = parseCoreUpdateTarget(updateArgs);
      itemId = parseUpdateItemId(updateArgs);
    } catch (err) {
      p.log.error((err as Error).message);
      return;
    }

    if (explicitCoreTarget && !coreOnly) {
      p.log.error("`--target` and `--to` are only supported with `notionx update --core`.");
      return;
    }

    if (coreOnly && itemId) {
      p.log.error("`notionx update --core` cannot be combined with an item id.");
      return;
    }

    if (coreOnly) {
      const { applyCoreUpdate } = await import("./registry/core-update.js");
      let summary;
      try {
        summary = await applyCoreUpdate({
          projectDir: process.cwd(),
          ...(dryRun ? { dryRun: true } : {}),
          ...(explicitCoreTarget ? { target: explicitCoreTarget } : {}),
        });
      } catch (err) {
        p.log.error((err as Error).message);
        return;
      }
      const label = dryRun ? "Core update dry run" : "Core update";
      p.log.info(`${label}: ${summary.changes.length} change(s).`);
      if (summary.skipped) p.log.info(summary.skipped);
      for (const change of summary.changes) {
        p.log.info(
          `  ${change.file} ${change.field}: ${change.from ?? "<absent>"} → ${change.to}`,
        );
      }
      for (const note of summary.followup) {
        p.log.warn(note);
      }
      return;
    }

    const tplDir = await resolveStarterTemplatesDir("blog");
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
      p.log.info(`  wrote .notionx/migrations/${f}`);
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
    // back into .notionx/migrations/. Not implemented yet.
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
      // `notionx init` and `add blog` is a no-op.
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
        // Not a notionx project, or no registry yet — that's fine.
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
          "\n  Run this inside a notionx project to see install status.",
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
    const tplDir = await resolveStarterTemplatesDir("blog");
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
    const tplDir = await resolveStarterTemplatesDir("blog");
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
    // next `notionx update` doesn't re-emit the same migration.
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

  if (command === "locale" && !subcommand) {
    p.log.info("Usage: npx notionx locale <add|list> ...");
    p.log.info("  add <locale> [--apply] [--with-notion] [--copy-from <locale>]");
    p.log.info("  list");
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
  notionx update [<item-id>] [--dry-run]
  notionx update --core [--dry-run] [--target latest|next] [--to <version-or-range>]
  notionx migrate --mark-applied <sequence>
  notionx diff
  notionx doctor
  notionx locale <add|list>
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

function parseUpdateItemId(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--to" || arg === "--target") {
      i++;
      continue;
    }
    if (arg.startsWith("--to=") || arg.startsWith("--target=")) continue;
    if (arg.startsWith("--")) continue;
    return arg;
  }
  return undefined;
}

function parseCoreUpdateTarget(
  args: readonly string[],
):
  | { kind: "dist-tag"; tag: "latest" | "next" }
  | { kind: "spec"; spec: string }
  | undefined {
  const to = readOptionValue(args, "--to");
  const target = readOptionValue(args, "--target");
  if (to && target) {
    throw new Error("Use either `--to` or `--target`, not both.");
  }
  if (to) return { kind: "spec", spec: to };
  if (!target) return undefined;
  if (target !== "latest" && target !== "next") {
    throw new Error("`--target` must be either `latest` or `next`.");
  }
  return { kind: "dist-tag", tag: target };
}

function readOptionValue(
  args: readonly string[],
  name: "--to" | "--target",
): string | undefined {
  const eq = args.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}
