/**
 * Tests for the shared installer helpers.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

import {
  resolveBaseDir,
  resolveCwd,
  writeUtf8,
  writeUnlessExists,
  planDirectoryFiles,
  planSingleFile,
} from "../src/targets/base.js";
import type { SkillBundle } from "../src/types.js";

let tmpRoot: string;
let cwd: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "nextion-skill-base-"));
  cwd = tmpRoot;
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("resolveBaseDir", () => {
  it("user scope: claude -> ~/.claude/skills/nextion", () => {
    const dir = resolveBaseDir("claude", "user", cwd);
    expect(dir).toMatch(/\.claude[\\/]skills[\\/]nextion$/);
  });

  it("user scope: trae -> ~/.trae/skills/nextion", () => {
    const dir = resolveBaseDir("trae", "user", cwd);
    expect(dir).toMatch(/\.trae[\\/]skills[\\/]nextion$/);
  });

  it("user scope: codex -> ~/.codex", () => {
    const dir = resolveBaseDir("codex", "user", cwd);
    expect(dir).toMatch(/\.codex$/);
  });

  it("user scope: cursor -> ~/.cursor/rules", () => {
    const dir = resolveBaseDir("cursor", "user", cwd);
    expect(dir).toMatch(/\.cursor[\\/]rules$/);
  });

  it("user scope: windsurf -> ~/.codeium/windsurf/memories", () => {
    const dir = resolveBaseDir("windsurf", "user", cwd);
    expect(dir).toMatch(/\.codeium[\\/]windsurf[\\/]memories$/);
  });

  it("user scope: copilot -> ~/.config/github-copilot/instructions", () => {
    const dir = resolveBaseDir("copilot", "user", cwd);
    expect(dir).toMatch(/\.config[\\/]github-copilot[\\/]instructions$/);
  });

  it("project scope: claude -> <cwd>/.claude/skills/nextion", () => {
    const dir = resolveBaseDir("claude", "project", cwd);
    expect(dir).toBe(resolve(cwd, ".claude", "skills", "nextion"));
  });

  it("project scope: codex -> <cwd> (AGENTS.md lives at repo root)", () => {
    const dir = resolveBaseDir("codex", "project", cwd);
    expect(dir).toBe(resolve(cwd));
  });

  it("project scope: cursor -> <cwd>/.cursor/rules", () => {
    const dir = resolveBaseDir("cursor", "project", cwd);
    expect(dir).toBe(resolve(cwd, ".cursor", "rules"));
  });
});

describe("resolveCwd", () => {
  it("returns absolute path for existing directory", () => {
    const result = resolveCwd(cwd);
    expect(result).toBe(resolve(cwd));
  });

  it("defaults to process.cwd()", () => {
    const result = resolveCwd(undefined);
    expect(result).toBe(resolve(process.cwd()));
  });

  it("throws on missing directory", () => {
    expect(() => resolveCwd(join(tmpRoot, "does-not-exist"))).toThrow();
  });
});

describe("writeUtf8", () => {
  it("writes a file and creates parent directories", async () => {
    const filePath = join(tmpRoot, "deep", "nested", "file.txt");
    const bytes = await writeUtf8(filePath, "hello");
    expect(bytes).toBe(5);
    expect(existsSync(filePath)).toBe(true);
    const content = await readFile(filePath, "utf8");
    expect(content).toBe("hello");
  });
});

describe("writeUnlessExists", () => {
  it("writes when file is missing", async () => {
    const filePath = join(tmpRoot, "new.txt");
    const result = await writeUnlessExists(filePath, "abc", {});
    expect("bytes" in result).toBe(true);
    if ("bytes" in result) {
      expect(result.bytes).toBe(3);
      expect(result.path).toBe(filePath);
    }
  });

  it("skips when file exists and force is not set", async () => {
    const filePath = join(tmpRoot, "exists.txt");
    await writeFile(filePath, "original", "utf8");
    const result = await writeUnlessExists(filePath, "replacement", {});
    expect("bytes" in result).toBe(false);
    if (!("bytes" in result)) {
      expect(result.reason).toContain("already exists");
    }
    const content = await readFile(filePath, "utf8");
    expect(content).toBe("original");
  });

  it("overwrites when force is true", async () => {
    const filePath = join(tmpRoot, "force.txt");
    await writeFile(filePath, "original", "utf8");
    const result = await writeUnlessExists(filePath, "new", { force: true });
    expect("bytes" in result).toBe(true);
    const content = await readFile(filePath, "utf8");
    expect(content).toBe("new");
  });

  it("returns a fake write in dry-run mode", async () => {
    const filePath = join(tmpRoot, "dryrun.txt");
    const result = await writeUnlessExists(filePath, "hello", { dryRun: true });
    expect("bytes" in result).toBe(true);
    if ("bytes" in result) {
      expect(result.bytes).toBe(5);
    }
    expect(existsSync(filePath)).toBe(false);
  });
});

describe("planDirectoryFiles", () => {
  it("produces SKILL.md, INSTALL.md, and references/ entries", () => {
    const bundle: SkillBundle = {
      skill: "SKILL",
      installGuide: "INSTALL",
      references: { architecture: "ARCH", deploy: "DEPLOY" },
      rules: { claude: "", trae: "", codex: "", cursor: "", windsurf: "", copilot: "" },
      version: "0.0.0",
    };
    const files = planDirectoryFiles("/base", bundle);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("/base/SKILL.md");
    expect(paths).toContain("/base/INSTALL.md");
    expect(paths).toContain("/base/references/architecture.md");
    expect(paths).toContain("/base/references/deploy.md");
  });
});

describe("planSingleFile", () => {
  it("produces a single file", () => {
    const files = planSingleFile("/dir", "rule.mdc", "BODY");
    expect(files).toHaveLength(1);
    expect(files[0]?.path).toBe("/dir/rule.mdc");
    expect(files[0]?.content).toBe("BODY");
  });
});
