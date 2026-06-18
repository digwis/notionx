// packages/notionx-cli/src/registry/migrations-types.ts
//
// v2 Migration Protocol — the on-disk format for
// `.notionx/migrations/`.
//
// Modeled on Prisma's `migrations/` directory: every change to a
// project's schema (D1 or Notion) is an immutable, append-only
// file with a monotonically-increasing sequence number. Once a
// migration has been applied to a real environment, **it is
// never edited**. To reverse a change, the user runs
// `notionx update` to apply a *new* migration that undoes it.
//
// Three kinds of migration live alongside each other:
//   - `.sql`       — D1 schema change (run by `wrangler d1 migrations apply`)
//   - `.notion.json`— Notion schema change (run by hand or via the
//                    Notion API in CI; PR 4 ships a *plan*, not the
//                    run)
//   - `.codemod.json`— TypeScript code transformation (run by
//                    `notionx update` against the user's code)
//
// A single migration usually has exactly one file. We bundle
// them in `_meta.json` so the planner can apply them in order
// and the user can see what changed.

/**
 * On-disk directory shape. Not exported as a single JSON file
 * (each migration is its own file); this type describes the
 * directory's contents.
 */
export interface MigrationDirectory {
  /**
   * Monotonically increasing sequence number. PR 4 will be the
   * first to write entries; the next update starts at the count
   * already in the directory. Format: zero-padded 4 digits.
   */
  nextSequence: number;
  /**
   * History of applied migrations. Each entry references one or
   * more files in the directory and the item/registry that
   * authored them.
   */
  history: AppliedMigration[];
}

/**
 * One applied migration. PR 4 emits one of these every time
 * `notionx update` produces a new file.
 */
export interface AppliedMigration {
  /** Sequence number, e.g. `0003`. */
  sequence: string;
  /** Item id this migration is attributed to. */
  itemId: string;
  /** Item kind (so we can disambiguate when the id collides). */
  itemKind: "content-source" | "feature-module" | "platform-extension";
  /** Optional human label, e.g. "add Author field to blog". */
  label?: string;
  /** What kind of file lives next to this entry. */
  file: MigrationFileRef;
  /** When the migration was generated (ISO). */
  generatedAt: string;
  /** Has the user (or wrangler, or Notion) applied it? */
  applied: boolean;
  /** Set when the user marks it as applied. ISO timestamp. */
  appliedAt?: string;
  /** Free-form notes for the user / reviewer. */
  notes?: string;
}

export type MigrationFileRef =
  | { kind: "d1-sql"; filename: string }
  | { kind: "notion-diff"; filename: string }
  | { kind: "ts-codemod"; filename: string }
  | { kind: "env"; filename: string }
  | { kind: "config-merge"; filename: string };

/**
 * A planned (not yet generated) migration step. `update.ts`
 * produces these from `RegistryMigration.steps`; the writer then
 * turns them into files.
 */
export type PlannedMigrationStep =
  | {
      kind: "d1-table-create";
      itemId: string;
      tableName: string;
      sql: string;
    }
  | {
      kind: "d1-table-alter";
      itemId: string;
      tableName: string;
      sql: string;
    }
  | {
      kind: "notion-field-add";
      itemId: string;
      dataSourceEnv: string;
      property: string;
      type: string;
    }
  | {
      kind: "notion-field-rename";
      itemId: string;
      dataSourceEnv: string;
      from: string;
      to: string;
    }
  | {
      kind: "notion-field-deprecate";
      itemId: string;
      dataSourceEnv: string;
      property: string;
      fallback?: string;
    }
  | {
      kind: "ts-codemod";
      itemId: string;
      transform: string;
      /** Files to be transformed. Empty = the user's whole project. */
      targets: string[];
    }
  | {
      kind: "env-add";
      itemId: string;
      name: string;
      default?: string;
      secret?: boolean;
    }
  | {
      kind: "config-merge";
      itemId: string;
      file: string;
      json: Record<string, unknown>;
    }
  | {
      kind: "d1-migration-file";
      itemId: string;
      file: string;
    };

/**
 * The full plan produced by `migration-planner.ts`. The CLI shows
 * this before asking the user to confirm. After confirmation, the
 * writer turns each step into a file in `.notionx/migrations/`.
 */
export interface UpdatePlan {
  /** Plan entries that have data-loss risk. The user MUST confirm. */
  destructive: PlannedMigrationStep[];
  /** Plan entries that are safe. */
  additive: PlannedMigrationStep[];
  /** Plan entries that are NoOps (already applied or no-op). */
  noop: PlannedMigrationStep[];
  /** Files that will be re-rendered (the templating step). */
  renderedFiles: string[];
  /** Codemod targets — human-readable paths so the user can review. */
  codemodTargets: string[];
}

/**
 * Public shape of the `_meta.json` file inside `.notionx/migrations/`.
 */
export interface MigrationMetaFile {
  $schema: "https://notionx.dev/schemas/migrations-meta.v1.json";
  nextSequence: number;
  history: AppliedMigration[];
}
