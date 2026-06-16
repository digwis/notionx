// packages/create-nextion-app/src/registry/migrations-store.test.ts

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MIGRATIONS_DIR,
  appendMigration,
  emptyMeta,
  markMigrationApplied,
  readMigrationsMeta,
  writeMigrationPayload,
  writeMigrationsMeta,
} from "./migrations-store.js";

describe("migrations-store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-mig-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("exposes the canonical .notionx/migrations/ path", () => {
    expect(MIGRATIONS_DIR).toBe(".notionx/migrations");
  });

  it("returns null when _meta.json does not exist", async () => {
    const meta = await readMigrationsMeta(dir);
    expect(meta).toBeNull();
  });

  it("emptyMeta() starts with nextSequence=1 and empty history", () => {
    const m = emptyMeta();
    expect(m.nextSequence).toBe(1);
    expect(m.history).toEqual([]);
  });

  it("writeMigrationsMeta + read round-trips", async () => {
    const m = emptyMeta();
    await writeMigrationsMeta(dir, m);
    const read = await readMigrationsMeta(dir);
    expect(read).toEqual(m);
  });

  it("appendMigration assigns 4-digit sequence numbers and bumps nextSequence", async () => {
    await writeMigrationsMeta(dir, emptyMeta());
    const { sequence, meta } = await appendMigration(dir, {
      itemId: "blog",
      itemKind: "content-source",
      file: { kind: "d1-sql", filename: "0001_init.sql" },
      applied: false,
      label: "init",
    });

    expect(sequence).toBe("0001");
    expect(meta.nextSequence).toBe(2);
    expect(meta.history).toHaveLength(1);
    expect(meta.history[0]?.sequence).toBe("0001");
    expect(meta.history[0]?.itemId).toBe("blog");
  });

  it("appendMigration is monotonic across many calls", async () => {
    await writeMigrationsMeta(dir, emptyMeta());
    for (let i = 1; i <= 5; i++) {
      const { sequence } = await appendMigration(dir, {
        itemId: "blog",
        itemKind: "content-source",
        file: { kind: "d1-sql", filename: `000${i}_x.sql` },
        applied: false,
      });
      expect(sequence).toBe(`000${i}`);
    }
    const meta = await readMigrationsMeta(dir);
    expect(meta?.nextSequence).toBe(6);
    expect(meta?.history.map((e) => e.sequence)).toEqual([
      "0001",
      "0002",
      "0003",
      "0004",
      "0005",
    ]);
  });

  it("markMigrationApplied is idempotent (only flips once)", async () => {
    await writeMigrationsMeta(dir, emptyMeta());
    await appendMigration(dir, {
      itemId: "blog",
      itemKind: "content-source",
      file: { kind: "d1-sql", filename: "0001_x.sql" },
      applied: false,
    });

    const first = await markMigrationApplied(dir, "0001");
    expect(first.history[0]?.applied).toBe(true);
    expect(first.history[0]?.appliedAt).toBeDefined();

    // Wait a tick so the second call's `appliedAt` would differ if
    // it actually re-wrote the timestamp. We assert the timestamp
    // didn't change, proving idempotency.
    const originalTimestamp = first.history[0]?.appliedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await markMigrationApplied(dir, "0001");
    expect(second.history[0]?.appliedAt).toBe(originalTimestamp);
  });

  it("markMigrationApplied throws when the directory is empty", async () => {
    await expect(markMigrationApplied(dir, "0001")).rejects.toThrow(
      /does not exist/,
    );
  });

  it("writeMigrationPayload writes the payload file alongside _meta.json", async () => {
    await writeMigrationsMeta(dir, emptyMeta());
    await writeMigrationPayload(dir, "0001_init.sql", "CREATE TABLE x (id INTEGER);");
    const raw = await readFile(
      path.join(dir, MIGRATIONS_DIR, "0001_init.sql"),
      "utf8",
    );
    expect(raw).toContain("CREATE TABLE x");
  });

  it("migrations are append-only: re-writing the same sequence is not allowed by the store", async () => {
    // We don't expose a "rewrite" API; ensure the public surface
    // doesn't let us accidentally edit a previous migration. The
    // only mutators are `writeMigrationsMeta` (whole-file) and
    // `appendMigration` (always uses nextSequence). A test that
    // calls writeMigrationsMeta with a "rewriting" intent has to
    // opt out by writing the whole meta — and even then,
    // `appendMigration` would never re-use a sequence.
    await writeMigrationsMeta(dir, emptyMeta());
    await appendMigration(dir, {
      itemId: "blog",
      itemKind: "content-source",
      file: { kind: "d1-sql", filename: "0001_x.sql" },
      applied: false,
    });
    const before = await readMigrationsMeta(dir);
    const firstEntryBefore = before?.history[0];

    // Second append must use sequence 0002, not 0001.
    await appendMigration(dir, {
      itemId: "blog",
      itemKind: "content-source",
      file: { kind: "d1-sql", filename: "0002_y.sql" },
      applied: false,
    });
    const after = await readMigrationsMeta(dir);
    const firstEntryAfter = after?.history[0];

    // The first entry is byte-identical to its pre-second-append
    // form (proving append-only for the first migration's record).
    expect(firstEntryAfter).toEqual(firstEntryBefore);
    expect(after?.history[1]?.sequence).toBe("0002");
  });
});

describe("migrations-store: dir layout", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "notionx-mig-dir-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates .notionx/migrations/ if missing", async () => {
    await writeMigrationsMeta(dir, emptyMeta());
    await writeMigrationPayload(dir, "0001_x.sql", "SELECT 1;");

    const sub = path.join(dir, ".notionx/migrations");
    const metaRaw = await readFile(path.join(sub, "_meta.json"), "utf8");
    const payload = await readFile(path.join(sub, "0001_x.sql"), "utf8");
    expect(metaRaw).toContain("nextSequence");
    expect(payload).toBe("SELECT 1;");
  });

  it("rejects writing payload without prior dir creation when mkdir fails — actually the store creates it", async () => {
    // Sanity: writeMigrationsMeta creates the dir, so a payload
    // write that arrives first still works (the store calls
    // mkdir({ recursive: true })).
    await writeMigrationPayload(dir, "0001_x.sql", "SELECT 2;");
    const raw = await readFile(
      path.join(dir, MIGRATIONS_DIR, "0001_x.sql"),
      "utf8",
    );
    expect(raw).toBe("SELECT 2;");
  });

  it("supports arbitrary filenames (the store does not enforce .sql extension)", async () => {
    // The registry may ship a `.notion-diff.json` or `.codemod.json`
    // payload. The store just writes whatever filename the caller
    // gives.
    await writeMigrationPayload(
      dir,
      "0001_add_author.notion-diff.json",
      JSON.stringify({ kind: "notion-field-add", property: "Author" }),
    );
    const raw = await readFile(
      path.join(
        dir,
        MIGRATIONS_DIR,
        "0001_add_author.notion-diff.json",
      ),
      "utf8",
    );
    expect(raw).toContain("notion-field-add");
  });
});
