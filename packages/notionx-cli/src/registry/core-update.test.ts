import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCoreUpdate } from "./core-update.js";
import { REGISTRY_SCHEMA_V2 } from "./registry-types.js";

const ORIGINAL_FETCH = globalThis.fetch;

let dir: string | undefined;

afterEach(async () => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function mkProject(input?: {
  core?: string;
  cli?: string;
  manifestCore?: string;
}): Promise<string> {
  dir = await mkdtemp(path.join(os.tmpdir(), "notionx-core-update-"));
  await mkdir(path.join(dir, ".notionx"), { recursive: true });
  await writeFile(
    path.join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: "demo",
        private: true,
        dependencies: { "@notionx/core": input?.core ?? "^2.0.0" },
        devDependencies: { "@notionx/cli": input?.cli ?? "^2.0.0" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(dir, ".notionx", "registry.json"),
    `${JSON.stringify(
      {
        $schema: REGISTRY_SCHEMA_V2,
        projectKind: "notionx",
        projectName: "demo",
        scaffoldVersion: "2.0.0",
        notionxCore: input?.manifestCore ?? "^2.0.0",
        defaultLocale: "en",
        supportedLocales: ["en"],
        enableSiteSettings: true,
        enableBlocks: true,
        enableAuth: true,
        enableAdmin: true,
        enablePages: true,
        enableSearch: true,
        contentSource: { id: "blog", title: "Blog", fields: [] },
        compat: { mode: "v2-native" },
        registries: {},
        installed: [],
        managedFiles: { platform: ["package.json"], bridge: [], user: [] },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return dir;
}

function mockPackageFetch(versions: Record<string, string>) {
  globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
    const value = String(url);
    const match = Object.entries(versions).find(([pkg]) => value.includes(pkg));
    return {
      ok: Boolean(match),
      status: match ? 200 : 404,
      json: async () => ({ version: match?.[1] }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("applyCoreUpdate", () => {
  it("updates package.json and registry.json for an explicit core spec", async () => {
    const projectDir = await mkProject();

    const summary = await applyCoreUpdate({
      projectDir,
      target: { kind: "spec", spec: "3.0.0" },
    });

    expect(summary.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "package.json", to: "3.0.0" }),
        expect.objectContaining({ file: ".notionx/registry.json", to: "3.0.0" }),
      ]),
    );

    const pkg = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
    expect(pkg.dependencies["@notionx/core"]).toBe("3.0.0");
    expect(pkg.devDependencies["@notionx/cli"]).toBe("^2.0.0");

    const manifest = JSON.parse(
      await readFile(path.join(projectDir, ".notionx", "registry.json"), "utf8"),
    );
    expect(manifest.notionxCore).toBe("3.0.0");
  });

  it("resolves npm dist-tags and updates the local maintenance CLI when present", async () => {
    const projectDir = await mkProject();
    mockPackageFetch({
      "@notionx/core": "3.1.0",
      "@notionx/cli": "2.1.0",
    });

    const summary = await applyCoreUpdate({
      projectDir,
      target: { kind: "dist-tag", tag: "latest" },
    });

    expect(summary.targetCore).toBe("^3.1.0");
    expect(summary.targetCli).toBe("^2.1.0");

    const pkg = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
    expect(pkg.dependencies["@notionx/core"]).toBe("^3.1.0");
    expect(pkg.devDependencies["@notionx/cli"]).toBe("^2.1.0");
  });

  it("does not write files in dry-run mode", async () => {
    const projectDir = await mkProject();
    mockPackageFetch({
      "@notionx/core": "3.1.0",
      "@notionx/cli": "2.1.0",
    });

    const beforePackage = await readFile(path.join(projectDir, "package.json"), "utf8");
    const beforeRegistry = await readFile(
      path.join(projectDir, ".notionx", "registry.json"),
      "utf8",
    );

    const summary = await applyCoreUpdate({
      projectDir,
      dryRun: true,
      target: { kind: "dist-tag", tag: "latest" },
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.changes.length).toBeGreaterThan(0);
    await expect(readFile(path.join(projectDir, "package.json"), "utf8")).resolves.toBe(
      beforePackage,
    );
    await expect(
      readFile(path.join(projectDir, ".notionx", "registry.json"), "utf8"),
    ).resolves.toBe(beforeRegistry);
  });

  it("skips implicit npm updates for workspace-linked projects", async () => {
    const projectDir = await mkProject({ core: "workspace:*", manifestCore: "workspace:*" });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const summary = await applyCoreUpdate({ projectDir });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(summary.skipped).toContain("workspace:*");
    expect(summary.changes).toEqual([]);
  });
});
