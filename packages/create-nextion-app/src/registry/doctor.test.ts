import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseDevVarsKeys, runProjectDoctor } from "./doctor.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";

function mkProject(setup: (dir: string) => void): string {
  const dir = mkdtempSync(path.join(tmpdir(), "nextion-doctor-"));
  setup(dir);
  return dir;
}

function writeJson(p: string, obj: unknown): void {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj));
}

const baseManifest = {
  $schema: REGISTRY_SCHEMA_V2,
  projectKind: "nextion" as const,
  scaffoldVersion: "0.7.0",
  nextionCore: "^1.0.0",
  compat: { mode: "v2-native" as const },
  registries: {
    "@notionx/official": {
      url: "https://registry.nextion.dev/official.json",
    },
  },
  installed: [],
};

const blogItem = {
  id: "blog",
  kind: "content-source" as const,
  version: 1,
  source: { kind: "official" as const, name: "@notionx/official" },
  publishedAt: "2026-06-16T00:00:00.000Z",
  params: { contentSourceId: "blog" },
  files: [],
  capabilities: {
    envVars: ["NOTION_BLOG_DATA_SOURCE_ID"],
    notionDataSources: ["NOTION_BLOG_DATA_SOURCE_ID"],
  },
  migrations: [],
};

describe("runProjectDoctor", () => {
  it("errors when registry.json is missing", async () => {
    const dir = mkProject(() => {});
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    expect(report.ok).toBe(false);
    expect(
      report.checks.find((c) => c.id === "registry.missing"),
    ).toBeDefined();
  });

  it("reports ok + env-ok when everything is wired up", async () => {
    const dir = mkProject((d) => {
      writeJson(path.join(d, ".nextion", "registry.json"), {
        ...baseManifest,
        installed: [
          {
            id: "blog",
            kind: "content-source",
            version: 1,
            source: { kind: "official", name: "@notionx/official" },
            params: {},
            installedAt: "2026-06-16T00:00:00.000Z",
          },
        ],
      });
      writeFileSync(
        path.join(d, ".dev.vars"),
        "NOTION_BLOG_DATA_SOURCE_ID=abc123\n# comment\n\n",
      );
    });
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    expect(report.ok).toBe(true);
    const envOk = report.checks.find((c) => c.id === "installed.blog.env-ok");
    expect(envOk).toBeDefined();
    expect(envOk?.severity).toBe("ok");
  });

  it("warns when an installed item's envVars are missing from .dev.vars", async () => {
    const dir = mkProject((d) => {
      writeJson(path.join(d, ".nextion", "registry.json"), {
        ...baseManifest,
        installed: [
          {
            id: "blog",
            kind: "content-source",
            version: 1,
            source: { kind: "official", name: "@notionx/official" },
            params: {},
            installedAt: "2026-06-16T00:00:00.000Z",
          },
        ],
      });
      writeFileSync(path.join(d, ".dev.vars"), "OTHER=foo\n");
    });
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    const envMissing = report.checks.find(
      (c) => c.id === "installed.blog.env-missing",
    );
    expect(envMissing?.severity).toBe("warn");
    expect(envMissing?.message).toContain("NOTION_BLOG_DATA_SOURCE_ID");
  });

  it("warns on pending migrations", async () => {
    const dir = mkProject((d) => {
      writeJson(path.join(d, ".nextion", "registry.json"), baseManifest);
      writeJson(path.join(d, ".nextion", "migrations", "_meta.json"), {
        $schema: "https://nextion.dev/schemas/migrations-meta.v1.json",
        nextSequence: 2,
        history: [
          {
            sequence: "0001",
            itemId: "blog",
            itemKind: "content-source",
            label: "blog 1->2",
            file: { kind: "d1-sql", filename: "blog_1_to_2.d1.sql" },
            applied: false,
            generatedAt: "2026-06-16T00:00:00.000Z",
          },
        ],
      });
    });
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    const pending = report.checks.find((c) => c.id === "migrations.pending");
    expect(pending?.severity).toBe("warn");
    expect(pending?.message).toContain("0001");
  });

  it("flags core.drift when package.json @notionx/core differs from manifest", async () => {
    const dir = mkProject((d) => {
      writeJson(path.join(d, ".nextion", "registry.json"), baseManifest);
      writeFileSync(
        path.join(d, "package.json"),
        JSON.stringify({
          name: "demo",
          dependencies: { "@notionx/core": "^2.0.0" },
        }),
      );
    });
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    const drift = report.checks.find((c) => c.id === "core.drift");
    expect(drift?.severity).toBe("info");
  });

  it("warns when an installed item is not in the catalog", async () => {
    const dir = mkProject((d) => {
      writeJson(path.join(d, ".nextion", "registry.json"), {
        ...baseManifest,
        installed: [
          {
            id: "ghost",
            kind: "content-source",
            version: 1,
            source: { kind: "official", name: "@notionx/official" },
            params: {},
            installedAt: "2026-06-16T00:00:00.000Z",
          },
        ],
      });
    });
    const report = await runProjectDoctor({
      projectDir: dir,
      catalogItems: [blogItem],
    });
    const ghost = report.checks.find(
      (c) => c.id === "installed.ghost.missing-in-catalog",
    );
    expect(ghost?.severity).toBe("warn");
  });
});

describe("parseDevVarsKeys", () => {
  it("ignores comments and blank lines", () => {
    const keys = parseDevVarsKeys("# header\n\nFOO=bar\n# trailing\nBAZ=qux\n");
    expect([...keys].sort()).toEqual(["BAZ", "FOO"]);
  });

  it("ignores lines without '='", () => {
    const keys = parseDevVarsKeys("NOPE\nFOO=bar\n");
    expect([...keys]).toEqual(["FOO"]);
  });
});
