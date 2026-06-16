// packages/create-nextion-app/src/registry/migration-planner.ts
//
// Convert catalog `RegistryItem.migrations` into a sequenced
// `UpdatePlan` that the CLI can show, then turn into files.
//
// The planner is **pure**: it does no I/O, takes the catalog + the
// installed manifest as inputs, and returns a plan. That makes
// it easy to test the bookkeeping (idempotency, downgrade
// detection, version-chain selection) without touching the file
// system.

import type {
  InstalledItem,
  RegistryItem,
} from "./registry-types.js";
import type {
  AppliedMigration,
  PlannedMigrationStep,
  UpdatePlan,
} from "./migrations-types.js";

export interface BuildUpdatePlanInput {
  installed: readonly InstalledItem[];
  catalogItems: readonly RegistryItem[];
  /**
   * History of migrations that have already been generated and
   * applied. The planner uses this to dedupe: a step already
   * applied does not need to be regenerated.
   */
  appliedMigrations: readonly AppliedMigration[];
}

/**
 * Look up the migration chain (a sequence of `from`/`to` hops)
 * that the planner is walking. Each hop is recorded as
 * `<itemId> <fromV>-><toV>` in the applied migration's `label`
 * (e.g. `blog 1->2`). The chain is a map from item id to the
 * list of `fromV->toV` strings the user has already applied.
 */
function indexAppliedChains(
  applied: readonly AppliedMigration[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of applied) {
    if (!m.label) continue;
    // Convention: `<itemId> <fromV>-><toV>`.
    const match = m.label.match(/^(.+)\s+(\d+)->(\d+)$/);
    if (!match) continue;
    const [, itemId, fromV, toV] = match;
    if (!itemId || !fromV || !toV) continue;
    const key = itemId;
    let set = out.get(key);
    if (!set) {
      set = new Set();
      out.set(key, set);
    }
    set.add(`${fromV}->${toV}`);
  }
  return out;
}

/**
 * Walk the catalog and the installed manifest, producing an
 * `UpdatePlan` of every step that needs to run to bring
 * `installed` up to date with `catalogItems`.
 *
 * What the planner does **not** do:
 *   - I/O. No file writes. The writer (`update.ts`) handles that.
 *   - Apply migrations itself. It just describes them.
 *   - Run codemods. Codemods are listed under `codemodTargets` and
 *     re-rendered as a hint to the user (and consumed by the
 *     writer).
 */
export function buildUpdatePlan(input: BuildUpdatePlanInput): UpdatePlan {
  const plan: UpdatePlan = {
    additive: [],
    destructive: [],
    noop: [],
    renderedFiles: [],
    codemodTargets: [],
  };
  const appliedChains = indexAppliedChains(input.appliedMigrations);

  for (const item of input.installed) {
    const catalog = input.catalogItems.find((c) => c.id === item.id);
    if (!catalog) continue; // unknown / third-party item

    if (catalog.version < item.version) {
      // Catalog is behind the project — never auto-downgrade.
      continue;
    }
    if (catalog.version === item.version) {
      // Up to date. Skip.
      continue;
    }

    // Find the **single hop** that starts at the project's
    // currently-installed version. We do *not* walk a multi-hop
    // chain here — each RegistryItem.migrations entry is one
    // hop, and the catalog author is expected to provide a
    // cumulative `from: "<id>@<currentV>", to: "<id>@<newV>"`
    // migration that bundles every step needed.
    //
    // After the user applies the hop, the next `notionx update`
    // call picks up the next one. This keeps each migration
    // independently testable + reversible.
    const hop = catalog.migrations.find((m) => {
      const fromV = parseInt(m.from.split("@")[1] ?? "", 10);
      return fromV === item.version;
    });
    if (!hop) continue;
    const toV = parseInt(hop.to.split("@")[1] ?? "", 10);
    if (Number.isNaN(toV) || toV <= item.version) continue;
    const hopApplied =
      appliedChains.get(item.id)?.has(`${item.version}->${toV}`) ?? false;

    for (const step of hop.steps) {
      const planStep = toPlannedStep(item, step);
      if (!planStep) continue;

      if (hopApplied) {
        plan.noop.push(planStep);
        continue;
      }

      if (isDestructiveStep(planStep)) {
        plan.destructive.push(planStep);
      } else {
        plan.additive.push(planStep);
      }
      if (planStep.kind === "ts-codemod") {
        plan.codemodTargets.push(...planStep.targets);
      }
    }
  }

  return plan;
}

// ---- internals ----

type RegistryStep = RegistryItem["migrations"][number]["steps"][number];

function parseInt(s: string, radix: number): number {
  return globalThis.parseInt(s, radix);
}

function toPlannedStep(
  item: InstalledItem,
  step: RegistryStep,
): PlannedMigrationStep | null {
  switch (step.kind) {
    case "notion-field-add":
      return {
        kind: "notion-field-add",
        itemId: item.id,
        dataSourceEnv: step.source,
        property: step.property,
        type: step.type,
      };
    case "notion-field-rename":
      return {
        kind: "notion-field-rename",
        itemId: item.id,
        dataSourceEnv: step.source,
        from: step.from,
        to: step.to,
      };
    case "notion-field-deprecate":
      return {
        kind: "notion-field-deprecate",
        itemId: item.id,
        dataSourceEnv: step.source,
        property: step.property,
        ...(step.fallback !== undefined
          ? { fallback: step.fallback }
          : {}),
      };
    case "d1-table-create":
      return {
        kind: "d1-table-create",
        itemId: item.id,
        tableName: step.name,
        sql: step.sql,
      };
    case "d1-table-alter":
      return {
        kind: "d1-table-alter",
        itemId: item.id,
        tableName: step.name,
        sql: step.sql,
      };
    case "ts-codemod":
      return {
        kind: "ts-codemod",
        itemId: item.id,
        transform: step.transform,
        targets: [step.file],
      };
    case "env-add":
      return {
        kind: "env-add",
        itemId: item.id,
        name: step.name,
        ...(step.default !== undefined ? { default: step.default } : {}),
        ...(step.secret !== undefined ? { secret: step.secret } : {}),
      };
    case "config-merge":
      return {
        kind: "config-merge",
        itemId: item.id,
        file: step.file,
        json: step.json,
      };
    case "d1-migration-file":
      return {
        kind: "d1-migration-file",
        itemId: item.id,
        file: step.file,
      };
  }
}

function isDestructiveStep(step: PlannedMigrationStep): boolean {
  switch (step.kind) {
    case "notion-field-rename":
    case "notion-field-deprecate":
    case "d1-table-alter":
      return true;
    case "notion-field-add":
    case "d1-table-create":
    case "ts-codemod":
    case "env-add":
    case "config-merge":
    case "d1-migration-file":
      return false;
  }
}
