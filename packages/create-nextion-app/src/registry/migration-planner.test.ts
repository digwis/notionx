// packages/create-nextion-app/src/registry/migration-planner.test.ts

import { describe, expect, it } from "vitest";

import { buildUpdatePlan } from "./migration-planner.js";
import type {
  InstalledItem,
  RegistryItem,
  RegistryMigration,
} from "./registry-types.js";
import type { AppliedMigration } from "./migrations-types.js";

const OFFICIAL: RegistryItem["source"] = {
  kind: "official",
  name: "@notionx/official",
};

function installedItem(
  id: string,
  version: number,
): InstalledItem {
  return {
    id,
    kind: "content-source",
    version,
    source: OFFICIAL,
    params: { contentSourceId: id },
    installedAt: "2026-06-10T00:00:00.000Z",
  };
}

function blogV2(): RegistryItem {
  return {
    id: "blog",
    kind: "content-source",
    version: 2,
    source: OFFICIAL,
    publishedAt: "2026-06-15T00:00:00.000Z",
    params: { contentSourceId: "blog" },
    files: [],
    capabilities: { envVars: ["NOTION_BLOG_DATA_SOURCE_ID"] },
    migrations: [
      {
        from: "blog@1",
        to: "blog@2",
        steps: [
          {
            kind: "notion-field-add",
            source: "NOTION_BLOG_DATA_SOURCE_ID",
            property: "Author",
            type: "people",
          },
          {
            kind: "notion-field-rename",
            source: "NOTION_BLOG_DATA_SOURCE_ID",
            from: "Eyebrow",
            to: "Subheadline",
          },
        ],
      },
    ],
  };
}

describe("buildUpdatePlan", () => {
  it("returns an empty plan when the installed version equals the catalog version", () => {
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 2)],
      catalogItems: [blogV2()],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([]);
    expect(plan.destructive).toEqual([]);
    expect(plan.noop).toEqual([]);
  });

  it("classifies notion-field-add as additive (safe, no data loss)", () => {
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [blogV2()],
      appliedMigrations: [],
    });
    const add = plan.additive.find(
      (s) => s.kind === "notion-field-add",
    );
    expect(add).toMatchObject({
      kind: "notion-field-add",
      itemId: "blog",
      dataSourceEnv: "NOTION_BLOG_DATA_SOURCE_ID",
      property: "Author",
      type: "people",
    });
    // The destructive bucket contains the rename — that's a
    // *separate* step. The test only checks add isn't in
    // destructive.
    expect(
      plan.destructive.find((s) => s.kind === "notion-field-add"),
    ).toBeUndefined();
  });

  it("classifies notion-field-rename as destructive (could lose data if it aliases to a wrong prop)", () => {
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [blogV2()],
      appliedMigrations: [],
    });
    const rename = plan.destructive.find(
      (s) => s.kind === "notion-field-rename",
    );
    expect(rename).toMatchObject({
      kind: "notion-field-rename",
      from: "Eyebrow",
      to: "Subheadline",
    });
  });

  it("skips steps whose migration is already in appliedMigrations (idempotent)", () => {
    const applied: AppliedMigration[] = [
      {
        sequence: "0001",
        itemId: "blog",
        itemKind: "content-source",
        label: "blog 1->2",
        file: { kind: "notion-diff", filename: "0001_blog.notion-diff.json" },
        generatedAt: "2026-06-15T00:00:00.000Z",
        applied: true,
        appliedAt: "2026-06-15T01:00:00.000Z",
      },
    ];
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [blogV2()],
      appliedMigrations: applied,
    });
    expect(plan.additive).toEqual([]);
    expect(plan.destructive).toEqual([]);
    expect(plan.noop.length).toBeGreaterThanOrEqual(2);
  });

  it("skips items the catalog does not know about (third-party items)", () => {
    const plan = buildUpdatePlan({
      installed: [installedItem("custom-team-source", 1)],
      catalogItems: [blogV2()],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([]);
    expect(plan.destructive).toEqual([]);
  });

  it("only emits migrations for the installed version, not for future versions", () => {
    // v1 installed, v3 in catalog. There's no v1->v2->v3 chain
    // expressed in the catalog, so the planner should only emit
    // v1->v2.
    const blogV3: RegistryItem = {
      ...blogV2(),
      version: 3,
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "notion-field-add",
              source: "NOTION_BLOG_DATA_SOURCE_ID",
              property: "Author",
              type: "people",
            },
          ],
        },
        {
          from: "blog@2",
          to: "blog@3",
          steps: [
            {
              kind: "d1-table-create",
              name: "blog_authors",
              sql: "CREATE TABLE blog_authors (id INTEGER PRIMARY KEY);",
            },
          ],
        },
      ],
    };
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [blogV3],
      appliedMigrations: [],
    });
    // We only get v1->v2 in the plan; v2->v3 is not yet reachable.
    expect(plan.additive.length).toBe(1);
    expect(plan.additive[0]).toMatchObject({
      kind: "notion-field-add",
      property: "Author",
    });
  });

  it("returns an empty plan when the installed version is *newer* than the catalog (downgrade blocked)", () => {
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 5)],
      catalogItems: [blogV2()], // catalog only has v2
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([]);
    expect(plan.destructive).toEqual([]);
  });
});

describe("buildUpdatePlan: codemod support", () => {
  it("includes ts-codemod steps in the additive bucket", () => {
    const item: RegistryItem = {
      id: "blog",
      kind: "content-source",
      version: 2,
      source: OFFICIAL,
      publishedAt: "2026-06-15T00:00:00.000Z",
      params: { contentSourceId: "blog" },
      files: [],
      capabilities: {},
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "ts-codemod",
              file: "app/blog/page.tsx",
              transform: "rename-eyebrow-to-subheadline",
            },
          ],
        },
      ] satisfies RegistryMigration[],
    };
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [item],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([
      {
        kind: "ts-codemod",
        itemId: "blog",
        transform: "rename-eyebrow-to-subheadline",
        targets: ["app/blog/page.tsx"],
      },
    ]);
    expect(plan.codemodTargets).toEqual(["app/blog/page.tsx"]);
  });
});

describe("buildUpdatePlan: env-add / config-merge / d1-migration-file", () => {
  it("classifies env-add as additive and forwards name/default/secret", () => {
    const item: RegistryItem = {
      id: "blog",
      kind: "content-source",
      version: 2,
      source: OFFICIAL,
      publishedAt: "2026-06-15T00:00:00.000Z",
      params: { contentSourceId: "blog" },
      files: [],
      capabilities: {},
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "env-add",
              name: "BLOG_SEARCH_INDEX_KEY",
              default: "dev-key",
              secret: true,
            },
          ],
        },
      ] satisfies RegistryMigration[],
    };
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [item],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([
      {
        kind: "env-add",
        itemId: "blog",
        name: "BLOG_SEARCH_INDEX_KEY",
        default: "dev-key",
        secret: true,
      },
    ]);
    expect(plan.destructive).toEqual([]);
  });

  it("classifies config-merge as additive and forwards file/json", () => {
    const mergeJson = { compatibility_date: "2026-07-01" };
    const item: RegistryItem = {
      id: "blog",
      kind: "content-source",
      version: 2,
      source: OFFICIAL,
      publishedAt: "2026-06-15T00:00:00.000Z",
      params: { contentSourceId: "blog" },
      files: [],
      capabilities: {},
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "config-merge",
              file: "wrangler.jsonc",
              json: mergeJson,
            },
          ],
        },
      ] satisfies RegistryMigration[],
    };
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [item],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([
      {
        kind: "config-merge",
        itemId: "blog",
        file: "wrangler.jsonc",
        json: mergeJson,
      },
    ]);
    expect(plan.destructive).toEqual([]);
  });

  it("classifies d1-migration-file as additive and forwards file", () => {
    const item: RegistryItem = {
      id: "blog",
      kind: "content-source",
      version: 2,
      source: OFFICIAL,
      publishedAt: "2026-06-15T00:00:00.000Z",
      params: { contentSourceId: "blog" },
      files: [],
      capabilities: {},
      migrations: [
        {
          from: "blog@1",
          to: "blog@2",
          steps: [
            {
              kind: "d1-migration-file",
              file: "migrations/0002_add_blog_indexes.sql",
            },
          ],
        },
      ] satisfies RegistryMigration[],
    };
    const plan = buildUpdatePlan({
      installed: [installedItem("blog", 1)],
      catalogItems: [item],
      appliedMigrations: [],
    });
    expect(plan.additive).toEqual([
      {
        kind: "d1-migration-file",
        itemId: "blog",
        file: "migrations/0002_add_blog_indexes.sql",
      },
    ]);
    expect(plan.destructive).toEqual([]);
  });
});
