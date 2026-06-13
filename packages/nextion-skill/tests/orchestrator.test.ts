/**
 * Tests for the skill loader and the orchestrator.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

import { loadLocal, loadBundled } from "../src/skill-source.js";
import { runInstall } from "../src/install.js";

let tmpRoot: string;
let cwd: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "nextion-skill-orch-"));
  cwd = tmpRoot;
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("loadBundled", () => {
  it("loads the skill that ships with the npm package", async () => {
    const bundle = await loadBundled("0.0.0-test");
    expect(bundle.skill).toContain("name: \"nextion\"");
    expect(bundle.installGuide).toContain("Installing the nextion skill");
    // The references should at least include the canonical ones.
    // Keys mirror the filenames: "content-source.md" -> "content-source", etc.
    expect(bundle.references.architecture).toBeDefined();
    expect(bundle.references["content-source"]).toBeDefined();
    expect(bundle.references["domain-module"]).toBeDefined();
    expect(bundle.references.deploy).toBeDefined();
    expect(bundle.references.troubleshooting).toBeDefined();
    expect(bundle.references["four-contracts"]).toBeDefined();
  });
});

describe("loadLocal", () => {
  it("loads the skill from the monorepo skills/nextion directory", async () => {
    // We're running inside the monorepo, so the local source should resolve.
    const bundle = await loadLocal("0.0.0-test");
    expect(bundle.skill).toContain("name: \"nextion\"");
    expect(bundle.installGuide).toBeDefined();
  });
});

describe("runInstall", () => {
  it("installs every target when --target=all", async () => {
    const { results } = await runInstall({
      target: "all",
      scope: "project",
      source: "npm",
      cwd,
    });
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.filesWritten.length).toBeGreaterThan(0);
    }
    expect(existsSync(resolve(cwd, ".claude", "skills", "nextion", "SKILL.md"))).toBe(true);
    expect(existsSync(resolve(cwd, ".trae", "skills", "nextion", "SKILL.md"))).toBe(true);
    expect(existsSync(resolve(cwd, "AGENTS.md"))).toBe(true);
  });

  it("installs only the requested target", async () => {
    const { results } = await runInstall({
      target: "trae",
      scope: "project",
      source: "npm",
      cwd,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.target).toBe("trae");
    expect(existsSync(resolve(cwd, ".trae", "skills", "nextion", "SKILL.md"))).toBe(true);
    expect(existsSync(resolve(cwd, ".claude"))).toBe(false);
    expect(existsSync(resolve(cwd, "AGENTS.md"))).toBe(false);
  });

  it("respects --dry-run (writes nothing)", async () => {
    const { results } = await runInstall({
      target: "all",
      scope: "project",
      source: "npm",
      cwd,
      dryRun: true,
    });
    for (const r of results) {
      expect(r.filesWritten.length).toBeGreaterThan(0);
    }
    expect(existsSync(resolve(cwd, ".claude"))).toBe(false);
    expect(existsSync(resolve(cwd, ".trae"))).toBe(false);
    expect(existsSync(resolve(cwd, "AGENTS.md"))).toBe(false);
  });

  it("refuses to overwrite without --force", async () => {
    // Pre-create the Trae skill directory with different content.
    await mkdir(resolve(cwd, ".trae", "skills", "nextion"), { recursive: true });
    await writeFile(
      resolve(cwd, ".trae", "skills", "nextion", "SKILL.md"),
      "ORIGINAL",
      "utf8",
    );
    const { results } = await runInstall({
      target: "trae",
      scope: "project",
      source: "npm",
      cwd,
    });
    const trae = results[0];
    expect(trae).toBeDefined();
    expect(trae?.filesSkipped.length).toBe(1);
    expect(trae?.filesSkipped[0]?.path).toBe(
      resolve(cwd, ".trae", "skills", "nextion", "SKILL.md"),
    );
    expect(trae?.filesWritten.length).toBeGreaterThan(0);
    await expect(
      readFile(resolve(cwd, ".trae", "skills", "nextion", "SKILL.md"), "utf8"),
    ).resolves.toBe("ORIGINAL");
  });
});
