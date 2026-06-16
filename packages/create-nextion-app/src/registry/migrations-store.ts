// packages/create-nextion-app/src/registry/migrations-store.ts
//
// Read / write `.notionx/migrations/`.
//
// Layout:
//
//   .notionx/
//   ├── registry.json
//   └── migrations/
//       ├── _meta.json
//       ├── 0001_init.sql
//       ├── 0002_add_blog_status.sql
//       └── 0003_rename_eyebrow.notion-diff.json
//
// `_meta.json` is the **index**. The .sql / .notion-diff.json /
// .codemod.json files are the **payloads**. Both are append-only:
// once written, a file is never edited. To "undo" a migration, run
// another one that does the opposite.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type MigrationMetaFile,
  type AppliedMigration,
} from "./migrations-types.js";

export const MIGRATIONS_DIR = ".notionx/migrations" as const;
export const MIGRATIONS_META = "_meta.json" as const;

export const MIGRATIONS_SCHEMA_V1 =
  "https://notionx.dev/schemas/migrations-meta.v1.json" as const;

/**
 * Empty `migrations/` directory shape. Used as the default when
 * the directory doesn't exist yet.
 */
export function emptyMeta(nextSequence = 1): MigrationMetaFile {
  return {
    $schema: MIGRATIONS_SCHEMA_V1,
    nextSequence,
    history: [],
  };
}

/**
 * Read `_meta.json` from `<projectDir>/.notionx/migrations/`. Returns
 * `null` when the directory doesn't exist (caller should treat as
 * empty migrations history).
 */
export async function readMigrationsMeta(
  projectDir: string,
): Promise<MigrationMetaFile | null> {
  const filePath = path.join(projectDir, MIGRATIONS_DIR, MIGRATIONS_META);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as MigrationMetaFile;
  } catch (err) {
    if (isENOENT(err)) return null;
    throw err;
  }
}

/**
 * Write `_meta.json` atomically (write to `.tmp`, then rename).
 */
export async function writeMigrationsMeta(
  projectDir: string,
  meta: MigrationMetaFile,
): Promise<void> {
  const dir = path.join(projectDir, MIGRATIONS_DIR);
  const target = path.join(dir, MIGRATIONS_META);
  const tmp = `${target}.tmp`;
  await mkdir(dir, { recursive: true });
  await writeFile(tmp, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  await rename(tmp, target);
}

/**
 * Append a single migration entry. Returns the new meta + the
 * sequence number assigned to this entry.
 *
 * Sequence number is the **previous** `nextSequence` value, zero-
 * padded to 4 digits. The meta's `nextSequence` is then
 * incremented by 1.
 */
export async function appendMigration(
  projectDir: string,
  entry: Omit<AppliedMigration, "sequence" | "generatedAt">,
): Promise<{ meta: MigrationMetaFile; sequence: string }> {
  const meta = (await readMigrationsMeta(projectDir)) ?? emptyMeta();
  const seq = String(meta.nextSequence).padStart(4, "0");
  const next: MigrationMetaFile = {
    ...meta,
    nextSequence: meta.nextSequence + 1,
    history: [
      ...meta.history,
      {
        ...entry,
        sequence: seq,
        generatedAt: new Date().toISOString(),
      },
    ],
  };
  await writeMigrationsMeta(projectDir, next);
  return { meta: next, sequence: seq };
}

/**
 * Mark an existing migration as applied. Idempotent.
 */
export async function markMigrationApplied(
  projectDir: string,
  sequence: string,
): Promise<MigrationMetaFile> {
  const meta = await readMigrationsMeta(projectDir);
  if (!meta) {
    throw new Error(
      `Cannot mark migration ${sequence} applied: .notionx/migrations/_meta.json does not exist.`,
    );
  }
  const next: MigrationMetaFile = {
    ...meta,
    history: meta.history.map((entry) =>
      entry.sequence === sequence && !entry.applied
        ? { ...entry, applied: true, appliedAt: new Date().toISOString() }
        : entry,
    ),
  };
  await writeMigrationsMeta(projectDir, next);
  return next;
}

/**
 * Write a migration payload file (the .sql or .notion-diff.json
 * next to `_meta.json`). Atomic. The filename is supplied by the
 * caller; we don't try to derive it from the entry.
 */
export async function writeMigrationPayload(
  projectDir: string,
  filename: string,
  content: string,
): Promise<void> {
  const dir = path.join(projectDir, MIGRATIONS_DIR);
  const target = path.join(dir, filename);
  const tmp = `${target}.tmp`;
  await mkdir(dir, { recursive: true });
  await writeFile(tmp, content, "utf8");
  await rename(tmp, target);
}

function isENOENT(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}
