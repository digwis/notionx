// packages/create-nextion-app/src/registry/update.test.ts

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveTemplatesDir } from "../render.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";
import { applyUpdate } from "./update.js";

const blogV2 = {
  id: "blog",
  kind: "content-source" as const,
  version: 2,
  source: { kind: "official" as const, name: "@notionx/official" },
  publishedAt: "2026-06-15T00:00:00.000Z",
  params: { contentSourceId: "blog" },
  files: [
    { path: "app/blog/page.tsx", ownership: "user" as const },
  ],
  capabilities: {
    envVars: ["NOTION_BLOG_DATA_SOURCE_ID"],
  },
  migrations: [
    {
      from: "blog@1",
      to: "blog@2",
      steps: [
        {
          kind: "notion-field-add" as const,
          source: "NOTION_BLOG_DATA_SOURCE_ID",
          property: "Author",
          type: "people",
        },
        {
          kind: "d1-table-create" as const,
          name: "blog_authors",
          sql: "CREATE TABLE blog_authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);",
        },
      ],
    },
  ],
};

const blogV1 = {
  ...blogV2,
  version: 1,
  migrations: [],
};

async function seedProject(
  projectDir: string,
  catalogItems: unknown[],
  installed: unknown[],
) {
  await writeFile(
    path.join(projectDir, "package.json"),
    JSON.stringify({
      name: "demo",
      version: "0.0.0",
      private: true,
      dependencies: { "@notionx/core": "^2.0.0" },
    }),
    "utf8",
  );
  await mkdir(path.join(projectDir, ".nextion"), { recursive: true });
  await writeFile(
    path.join(projectDir, ".nextion/registry.json"),
    JSON.stringify({
      $schema: REGISTRY_SCHEMA_V2,
      projectKind: "nextion",
      scaffoldVersion: "2.0.0",
      nextionCore: "^2.0.0",
      compat: { mode: "v2-native" },
      registries: {},
      installed,
      managedFiles: { platform: ["package.json"], bridge: [], user: [] },
    }),
    "utf8",
  );

  // Inject a fake catalog by writing a tiny catalog module that
  // applyUpdate reads via the `catalog` param.
  return { catalog: catalogItems };
}

describe("applyUpdate", () => {
  let dir: string;
  let templatesDir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "nextion-update-"));
    await mkdir(path.join(dir, ".nextion"), { recursive: true });
    templatesDir = await resolveTemplatesDir();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("generates a migration file + _meta entry, without modifying the data source", async () => {
    const { catalog } = await seedProject(dir, [blogV2], [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    const summary = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });

    expect(summary.plans.additive.length).toBeGreaterThan(0);
    expect(summary.wroteFiles).toContain("blog_1_to_2.notion-diff.json");
    expect(summary.wroteFiles).toContain("blog_1_to_2.d1.sql");
    expect(summary.wroteFiles).toContain("_meta.json");

    // The Notion diff was written but the Notion data source was
    // not touched (we don't have a network call here).
    const notionDiffPath = path.join(
      dir,
      ".nextion/migrations/blog_1_to_2.notion-diff.json",
    );
    const diff = JSON.parse(await readFile(notionDiffPath, "utf8"));
    expect(diff.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "notion-field-add", property: "Author" }),
      ]),
    );

    // The D1 SQL file was written
    const sql = await readFile(
      path.join(dir, ".nextion/migrations/blog_1_to_2.d1.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE blog_authors");

    // _meta.json is updated
    const meta = JSON.parse(
      await readFile(
        path.join(dir, ".nextion/migrations/_meta.json"),
        "utf8",
      ),
    );
    expect(meta.nextSequence).toBe(2);
    expect(meta.history).toHaveLength(1);
    expect(meta.history[0]?.label).toBe("blog 1->2");
  });

  it("is idempotent: a second call with the same catalog produces no new files", async () => {
    const { catalog } = await seedProject(dir, [blogV2], [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    const first = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });
    expect(first.wroteFiles.length).toBeGreaterThan(0);

    const second = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });

    // Second run: no new payloads written, but _meta.json still
    // gets re-written (the planner sees the same set).
    expect(second.plans.additive).toEqual([]);
    expect(second.plans.destructive).toEqual([]);
    expect(second.plans.noop.length).toBeGreaterThan(0);
  });

  it("skips items already at the catalog version", async () => {
    const { catalog } = await seedProject(dir, [blogV2], [
      {
        id: "blog",
        kind: "content-source",
        version: 2,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    const summary = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });
    expect(summary.wroteFiles).toEqual([]);
    expect(summary.plans.additive).toEqual([]);
    expect(summary.plans.destructive).toEqual([]);
  });

  it("blocks downgrades: installed v2 + catalog v1 produces no plan", async () => {
    const { catalog } = await seedProject(dir, [blogV1], [
      {
        id: "blog",
        kind: "content-source",
        version: 2,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    const summary = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });
    expect(summary.plans.additive).toEqual([]);
    expect(summary.plans.destructive).toEqual([]);
  });

  it("batches additive + destructive into the same migration file (one seq, multiple payloads)", async () => {
    const blogV3 = {
      ...blogV2,
      version: 3,
      migrations: [
        {
          from: "blog@1",
          to: "blog@3",
          steps: [
            {
              kind: "notion-field-add" as const,
              source: "NOTION_BLOG_DATA_SOURCE_ID",
              property: "Author",
              type: "people",
            },
            {
              kind: "notion-field-rename" as const,
              source: "NOTION_BLOG_DATA_SOURCE_ID",
              from: "Eyebrow",
              to: "Subheadline",
            },
          ],
        },
      ],
    };

    const { catalog } = await seedProject(dir, [blogV3], [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    const summary = await applyUpdate({
      projectDir: dir,
      templatesDir,
      catalogItems: catalog as never,
    });

    // One additive, one destructive, one seq, two payload files
    expect(summary.plans.additive).toHaveLength(1);
    expect(summary.plans.destructive).toHaveLength(1);
    expect(summary.wroteFiles).toContain("blog_1_to_3.notion-diff.json");
  });
});
