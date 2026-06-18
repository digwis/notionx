// packages/notionx-cli/src/registry/update.ts
//
// `notionx update` entry point. v2 protocol.
//
// What this does:
//   1. Read `.notionx/registry.json`.
//   2. Walk the installed manifest, compare versions to the
//      catalog.
//   3. For each upgradable item, build a `UpdatePlan` (pure) and
//      write **one set of payload files** per chain hop:
//        - `.notionx/migrations/NNNN_<item>_<from>_<to>.notion-diff.json`
//        - `.notionx/migrations/NNNN_<item>_<from>_<to>.d1.sql`
//        - `.notionx/migrations/_meta.json` (always rewritten)
//   4. **Never** touch Notion or D1 directly. The user runs the
//      migration by hand (or via the future `notionx migrate`
//      command).
//   5. Re-render `lib/content/models.ts` so the registry stays
//      in sync with the new catalog shape.
//
// Codemods (TS transformations) and `user`-owned file re-renders
// are scaffolded in PR 4 but not yet active; the planner already
// classifies them and `applyUpdate` records them in the
// `UpdatePlan` so the CLI can report them.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadRegistry } from "./load-registry.js";
import { buildUpdatePlan } from "./migration-planner.js";
import {
  appendMigration,
  emptyMeta,
  MIGRATIONS_META,
  readMigrationsMeta,
  writeMigrationPayload,
} from "./migrations-store.js";
import { renderContentSourceFiles } from "./render-content-source-files.js";
import { readProjectMeta } from "./project-meta.js";
import type {
  InstalledItem,
  RegistryItem,
  RegistryManifest,
} from "./registry-types.js";
import type { MigrationFileRef, UpdatePlan } from "./migrations-types.js";

export type UpdateScope =
  | { kind: "all" }
  | { kind: "item"; itemId: string };

export interface ApplyUpdateInput {
  projectDir: string;
  templatesDir: string;
  catalogItems: readonly RegistryItem[];
  dryRun?: boolean;
  /**
   * Restrict the update plan. Default `{ kind: "all" }` walks
   * every installed item. `{ kind: "item", itemId }` walks only
   * that item; missing items surface as a thrown error so the
   * CLI can print a helpful message instead of a silent no-op.
   */
  scope?: UpdateScope;
}

export interface ApplyUpdateSummary {
  plans: UpdatePlan;
  /** Sequence number assigned to the freshly generated migration (if any). */
  sequence?: string;
  /** Relative paths of all files written. */
  wroteFiles: string[];
  /** Project relative path of the registry.json if it was rewritten. */
  wroteManifest: boolean;
  /** Re-rendered files (e.g. models.ts). */
  rerenderedFiles: string[];
  /** Followup tasks for the human to perform by hand. */
  followup: string[];
}

export async function applyUpdate(
  input: ApplyUpdateInput,
): Promise<ApplyUpdateSummary> {
  const { projectDir, templatesDir, catalogItems } = input;

  const loaded = await loadRegistry(projectDir);
  const manifest = loaded.manifest;
  const applied = (await readMigrationsMeta(projectDir)) ?? emptyMeta();

  // Resolve scope before the planner sees anything: filtering
  // here keeps the planner pure (it still takes plain arrays)
  // and lets us surface a friendly error for unknown item ids.
  const scope: UpdateScope = input.scope ?? { kind: "all" };
  const installed = filterInstalledByScope(manifest.installed, scope);
  const catalogItemsScoped = filterCatalogByScope(catalogItems, scope, manifest);

  // Project meta for token rendering. We reuse the same helper
  // install.ts uses — read package.json to get the project name.
  const project = await readProjectMeta(projectDir, manifest);

  const plan = buildUpdatePlan({
    installed,
    catalogItems: catalogItemsScoped,
    appliedMigrations: applied.history,
  });

  // Group steps by (itemId, fromV, toV) hop. We assume the
  // planner emits at most one hop per item (single-hop rule).
  // PR 4 keeps that constraint explicit; multi-hop will be a
  // small extension.
  const hops = new Map<
    string,
    {
      itemId: string;
      fromV: number;
      toV: number;
      additive: UpdatePlan["additive"];
      destructive: UpdatePlan["destructive"];
    }
  >();

  for (const step of [...plan.additive, ...plan.destructive]) {
    const key = `${step.itemId}@${itemVersionById(manifest.installed, step.itemId)}`;
    let hop = hops.get(key);
    if (!hop) {
      const fromV = itemVersionById(manifest.installed, step.itemId);
      const toV = itemTargetVersion(catalogItems, step.itemId);
      hop = { itemId: step.itemId, fromV, toV, additive: [], destructive: [] };
      hops.set(key, hop);
    }
    if (plan.additive.includes(step)) hop.additive.push(step);
    else hop.destructive.push(step);
  }

  const wroteFiles: string[] = [];
  let sequence: string | undefined;
  const followup: string[] = [];
  const rerenderedFiles: string[] = [];

  if (input.dryRun) {
    return {
      plans: plan,
      wroteFiles,
      wroteManifest: false,
      rerenderedFiles,
      followup,
    };
  }

  // Write the per-hop payload files. We always do additive
  // + destructive in the same migration (one seq, multiple
  // payload files) so the user's bookkeeping is "one
  // migration per item version".
  for (const hop of hops.values()) {
    if (hop.additive.length === 0 && hop.destructive.length === 0) continue;
    const slug = `${hop.itemId}_${hop.fromV}_to_${hop.toV}`;

    // Notion diff (if any notion-* steps).
    const notionSteps = [...hop.additive, ...hop.destructive].filter(
      (s) =>
        s.kind === "notion-field-add" ||
        s.kind === "notion-field-rename" ||
        s.kind === "notion-field-deprecate",
    );
    if (notionSteps.length > 0) {
      const filename = `${slug}.notion-diff.json`;
      const payload = JSON.stringify(
        { itemId: hop.itemId, fromV: hop.fromV, toV: hop.toV, steps: notionSteps },
        null,
        2,
      );
      await writeMigrationPayload(projectDir, filename, `${payload}\n`);
      wroteFiles.push(filename);
      followup.push(
        `Apply Notion diff by running the steps in ${filename} (manually or via Notion API).`,
      );
    }

    // D1 SQL (if any d1-* steps, including d1-migration-file refs).
    const d1Steps = [...hop.additive, ...hop.destructive].filter(
      (s) =>
        s.kind === "d1-table-create" ||
        s.kind === "d1-table-alter" ||
        s.kind === "d1-migration-file",
    );
    if (d1Steps.length > 0) {
      const filename = `${slug}.d1.sql`;
      const sql = d1Steps
        .map((s) => {
          if (s.kind === "d1-table-create" || s.kind === "d1-table-alter") {
            return `-- ${s.itemId}: ${s.kind} ${s.tableName}\n${s.sql}`;
          }
          if (s.kind === "d1-migration-file") {
            return `-- ${s.itemId}: d1-migration-file (apply the SQL in ${s.file})`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
      await writeMigrationPayload(projectDir, filename, `${sql}\n`);
      wroteFiles.push(filename);
      followup.push(
        `Apply D1 SQL with: wrangler d1 migrations apply <DB_NAME> --remote`,
      );
    }

    // Env vars (if any env-add steps).
    const envSteps = [...hop.additive, ...hop.destructive].filter(
      (s) => s.kind === "env-add",
    );
    if (envSteps.length > 0) {
      const filename = `${slug}.env.json`;
      const payload = JSON.stringify(
        {
          itemId: hop.itemId,
          fromV: hop.fromV,
          toV: hop.toV,
          vars: envSteps.map((s) =>
            s.kind === "env-add"
              ? {
                  name: s.name,
                  ...(s.default !== undefined ? { default: s.default } : {}),
                  ...(s.secret !== undefined ? { secret: s.secret } : {}),
                }
              : null,
          ),
        },
        null,
        2,
      );
      await writeMigrationPayload(projectDir, filename, `${payload}\n`);
      wroteFiles.push(filename);
      for (const s of envSteps) {
        if (s.kind !== "env-add") continue;
        const hint = s.secret
          ? `Set secret ${s.name} with: wrangler secret put ${s.name}`
          : `Add ${s.name} to your .dev.vars and wrangler.jsonc vars`;
        followup.push(hint);
      }
    }

    // Config merge (if any config-merge steps).
    const configSteps = [...hop.additive, ...hop.destructive].filter(
      (s) => s.kind === "config-merge",
    );
    if (configSteps.length > 0) {
      const filename = `${slug}.config-merge.json`;
      const payload = JSON.stringify(
        {
          itemId: hop.itemId,
          fromV: hop.fromV,
          toV: hop.toV,
          merges: configSteps.map((s) =>
            s.kind === "config-merge"
              ? { file: s.file, json: s.json }
              : null,
          ),
        },
        null,
        2,
      );
      await writeMigrationPayload(projectDir, filename, `${payload}\n`);
      wroteFiles.push(filename);
      followup.push(
        `Merge config changes from ${filename} into the referenced files (deep-merge each entry's json into the target file).`,
      );
    }

    // Append the migration entry to _meta.json. **The sequence
    // number is whatever `appendMigration` assigns** (the
    // canonical nextSequence from the directory). The payload
    // filenames use the **un-padded** version pair as a slug, so
    // they're stable across replays of the same hop.
    const fileRef = pickMigrationFileRef(slug, {
      notion: notionSteps.length > 0,
      d1: d1Steps.length > 0,
      env: envSteps.length > 0,
      config: configSteps.length > 0,
    });
    const entry = await appendMigration(projectDir, {
      itemId: hop.itemId,
      itemKind: "content-source", // refined in PR 4.5 from the catalog
      label: `${hop.itemId} ${hop.fromV}->${hop.toV}`,
      file: fileRef,
      applied: false,
    });
    sequence = entry.sequence;
    wroteFiles.push(MIGRATIONS_META);
  }

  // Re-render every declared file for any installed item whose
  // version moved (so bridges, pages, and API routes all stay in
  // sync with the catalog version bump). We *don't* re-render
  // when no hops were generated — the user hasn't moved versions,
  // so nothing changed.
  if (hops.size > 0) {
    for (const item of installed) {
      const catalog = catalogItems.find((c) => c.id === item.id);
      if (!catalog) continue;
      // Skip items that didn't move versions.
      if (catalog.version === item.version) continue;
      const rendered = await renderContentSourceFiles({
        projectDir,
        templatesDir,
        item: catalog,
        installed: manifest.installed,
        project,
      });
      for (const f of rendered) {
        await mkdir(path.dirname(f.absolutePath), { recursive: true });
        await writeFile(f.absolutePath, f.content, "utf8");
        rerenderedFiles.push(f.projectRelativePath);
      }
    }
  }

  // The registry's `installed[].version` field is **never** bumped
  // by `applyUpdate`. The bump only happens after the user
  // confirms they applied the migration by running
  // `notionx migrate --mark-applied <seq>`. This is what
  // guarantees the migration is safe to retry: if the user
  // aborts mid-way, the next `notionx update` will detect
  // they're still on the old version and re-emit the same plan.
  //
  // We still re-render the bridge files (worker/index.ts,
  // models.ts, etc.) so the *source code* is in sync with what
  // the *next applied* migration will produce. The user can
  // ship that code immediately; the migration itself is what
  // backfills their data.

  return {
    plans: plan,
    ...(sequence !== undefined ? { sequence } : {}),
    wroteFiles,
    wroteManifest: false,
    rerenderedFiles,
    followup,
  };
}

// ---- internals ----

function itemVersionById(
  installed: readonly InstalledItem[],
  id: string,
): number {
  return installed.find((i) => i.id === id)?.version ?? 0;
}

function itemTargetVersion(
  catalog: readonly RegistryItem[],
  id: string,
): number {
  return catalog.find((c) => c.id === id)?.version ?? 0;
}

/**
 * Pick the `MigrationFileRef` for the migration entry. Priority
 * order matches the payload-writing blocks above. Falls back to
 * `d1-sql` when no payload file was written (e.g. ts-codemod-only
 * hops) so the entry always has a valid `file` field — the
 * pre-existing behaviour.
 */
function pickMigrationFileRef(
  slug: string,
  present: { notion: boolean; d1: boolean; env: boolean; config: boolean },
): MigrationFileRef {
  if (present.notion) return { kind: "notion-diff", filename: `${slug}.notion-diff.json` };
  if (present.d1) return { kind: "d1-sql", filename: `${slug}.d1.sql` };
  if (present.env) return { kind: "env", filename: `${slug}.env.json` };
  if (present.config) return { kind: "config-merge", filename: `${slug}.config-merge.json` };
  return { kind: "d1-sql", filename: `${slug}.d1.sql` };
}


// ---- scope helpers ----

function filterInstalledByScope(
  installed: readonly InstalledItem[],
  scope: UpdateScope,
): InstalledItem[] {
  if (scope.kind === "all") return installed.slice();
  const match = installed.find((i) => i.id === scope.itemId);
  if (!match) {
    throw new Error(
      `Cannot update "${scope.itemId}": not installed. Run \`notionx diff\` to see installed items.`,
    );
  }
  return [match];
}

function filterCatalogByScope(
  catalog: readonly RegistryItem[],
  scope: UpdateScope,
  _manifest: RegistryManifest,
): RegistryItem[] {
  if (scope.kind === "all") return catalog.slice();
  const match = catalog.find((c) => c.id === scope.itemId);
  if (!match) {
    throw new Error(
      `Cannot update "${scope.itemId}": not present in the official catalog.`,
    );
  }
  return [match];
}
