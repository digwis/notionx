/**
 * Tests for each platform installer.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

import { installClaude } from "../src/targets/claude.js";
import { installTrae } from "../src/targets/trae.js";
import { installCodex } from "../src/targets/codex.js";
import { installCursor } from "../src/targets/cursor.js";
import { installWindsurf } from "../src/targets/windsurf.js";
import { installCopilot } from "../src/targets/copilot.js";
import type { SkillBundle } from "../src/types.js";

function fakeBundle(): SkillBundle {
  return {
    skill: "---\nname: test\n---\n# Test skill",
    installGuide: "# Install guide",
    references: {
      architecture: "# Arch",
      "content-source": "# CS",
    },
    rules: {
      claude: "",
      trae: "",
      codex: "# Codex rule\n\nnextion conventions go here.",
      cursor: "---\ndescription: cursor rule\n---\n# Cursor",
      windsurf: "# Windsurf rule",
      copilot: "# Copilot instructions",
    },
    version: "0.0.0-test",
  };
}

let tmpRoot: string;
let cwd: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "nextion-skill-target-"));
  cwd = tmpRoot;
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("installClaude", () => {
  it("writes SKILL.md, INSTALL.md, and references/ in project scope", async () => {
    const result = await installClaude(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("claude");
    expect(result.scope).toBe("project");
    const baseDir = resolve(cwd, ".claude", "skills", "nextion");
    expect(existsSync(join(baseDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(baseDir, "INSTALL.md"))).toBe(true);
    expect(existsSync(join(baseDir, "references", "architecture.md"))).toBe(true);
    expect(existsSync(join(baseDir, "references", "content-source.md"))).toBe(true);
    const skill = await readFile(join(baseDir, "SKILL.md"), "utf8");
    expect(skill).toBe("---\nname: test\n---\n# Test skill");
  });

  it("skips existing files unless force is set", async () => {
    await installClaude(fakeBundle(), { scope: "project", cwd });
    const baseDir = resolve(cwd, ".claude", "skills", "nextion");
    const skillPath = join(baseDir, "SKILL.md");
    await writeFile(skillPath, "ORIGINAL", "utf8");

    // second run without force -> skipped
    const result = await installClaude(fakeBundle(), { scope: "project", cwd });
    expect(result.filesWritten).toHaveLength(0);
    expect(result.filesSkipped.length).toBeGreaterThan(0);
    const after = await readFile(skillPath, "utf8");
    expect(after).toBe("ORIGINAL");

    // with force -> overwritten
    const forced = await installClaude(fakeBundle(), {
      scope: "project",
      cwd,
      force: true,
    });
    expect(forced.filesWritten.length).toBeGreaterThan(0);
    const overwritten = await readFile(skillPath, "utf8");
    expect(overwritten).toBe("---\nname: test\n---\n# Test skill");
  });

  it("dry-run reports what would be written without touching disk", async () => {
    const result = await installClaude(fakeBundle(), {
      scope: "project",
      cwd,
      dryRun: true,
    });
    expect(result.filesWritten.length).toBeGreaterThan(0);
    const baseDir = resolve(cwd, ".claude", "skills", "nextion");
    expect(existsSync(baseDir)).toBe(false);
  });
});

describe("installTrae", () => {
  it("writes SKILL.md and references/ in project scope", async () => {
    const result = await installTrae(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("trae");
    const baseDir = resolve(cwd, ".trae", "skills", "nextion");
    expect(existsSync(join(baseDir, "SKILL.md"))).toBe(true);
    expect(existsSync(join(baseDir, "references", "architecture.md"))).toBe(true);
  });
});

describe("installCursor", () => {
  it("writes a single .mdc file", async () => {
    const result = await installCursor(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("cursor");
    const file = resolve(cwd, ".cursor", "rules", "nextion.mdc");
    expect(existsSync(file)).toBe(true);
    const content = await readFile(file, "utf8");
    expect(content).toContain("Cursor");
  });

  it("respects --force on existing files", async () => {
    const file = resolve(cwd, ".cursor", "rules", "nextion.mdc");
    await mkdir(resolve(cwd, ".cursor", "rules"), { recursive: true });
    await writeFile(file, "OLD", "utf8");

    const noForce = await installCursor(fakeBundle(), { scope: "project", cwd });
    expect(noForce.filesWritten).toHaveLength(0);
    expect(await readFile(file, "utf8")).toBe("OLD");

    const withForce = await installCursor(fakeBundle(), {
      scope: "project",
      cwd,
      force: true,
    });
    expect(withForce.filesWritten.length).toBe(1);
    expect(await readFile(file, "utf8")).toContain("Cursor");
  });
});

describe("installWindsurf", () => {
  it("writes nextion.md in .windsurfrules/", async () => {
    const result = await installWindsurf(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("windsurf");
    const file = resolve(cwd, ".windsurfrules", "nextion.md");
    expect(existsSync(file)).toBe(true);
    const content = await readFile(file, "utf8");
    expect(content).toContain("Windsurf");
  });
});

describe("installCopilot", () => {
  it("writes copilot-instructions.md in .github/", async () => {
    const result = await installCopilot(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("copilot");
    const file = resolve(cwd, ".github", "copilot-instructions.md");
    expect(existsSync(file)).toBe(true);
    const content = await readFile(file, "utf8");
    expect(content).toContain("Copilot");
  });
});

describe("installCodex", () => {
  it("creates AGENTS.md when it does not exist (project scope)", async () => {
    const result = await installCodex(fakeBundle(), { scope: "project", cwd });
    expect(result.target).toBe("codex");
    expect(result.filesSkipped).toHaveLength(0);
    expect(result.filesWritten).toHaveLength(1);
    const file = resolve(cwd, "AGENTS.md");
    expect(existsSync(file)).toBe(true);
    const content = await readFile(file, "utf8");
    expect(content).toContain("Codex rule");
  });

  it("appends a ## nextion section when AGENTS.md already exists", async () => {
    const file = resolve(cwd, "AGENTS.md");
    await writeFile(file, "# Existing project conventions\n\nSome stuff.\n", "utf8");
    const result = await installCodex(fakeBundle(), { scope: "project", cwd });
    expect(result.filesSkipped).toHaveLength(0);
    const after = await readFile(file, "utf8");
    expect(after).toContain("Existing project conventions");
    expect(after).toContain("Some stuff.");
    expect(after).toContain("## nextion");
    expect(after).toContain("Codex rule");
  });

  it("skips when a ## nextion section is already present", async () => {
    const file = resolve(cwd, "AGENTS.md");
    await writeFile(
      file,
      "# Project\n\n## nextion\n\nAlready installed.\n",
      "utf8",
    );
    const result = await installCodex(fakeBundle(), { scope: "project", cwd });
    expect(result.filesWritten).toHaveLength(0);
    expect(result.filesSkipped).toHaveLength(1);
    expect(result.filesSkipped[0]?.reason).toContain("already present");
    const after = await readFile(file, "utf8");
    expect(after).toContain("Already installed.");
  });

  it("overwrites with --force", async () => {
    const file = resolve(cwd, "AGENTS.md");
    await writeFile(file, "# Old content\n", "utf8");
    const result = await installCodex(fakeBundle(), {
      scope: "project",
      cwd,
      force: true,
    });
    expect(result.filesWritten).toHaveLength(1);
    const after = await readFile(file, "utf8");
    expect(after).toContain("Codex rule");
    expect(after).not.toContain("Old content");
  });

  it("dry-run reports the would-be write without touching disk", async () => {
    const file = resolve(cwd, "AGENTS.md");
    const result = await installCodex(fakeBundle(), {
      scope: "project",
      cwd,
      dryRun: true,
    });
    expect(result.filesWritten).toHaveLength(1);
    expect(existsSync(file)).toBe(false);
  });

  it("dry-run on existing file reports an append", async () => {
    const file = resolve(cwd, "AGENTS.md");
    await writeFile(file, "# Existing\n", "utf8");
    const result = await installCodex(fakeBundle(), {
      scope: "project",
      cwd,
      dryRun: true,
    });
    expect(result.filesWritten).toHaveLength(1);
    // file should not be modified
    const after = await readFile(file, "utf8");
    expect(after).toBe("# Existing\n");
  });
});
