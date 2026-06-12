import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyDefaults, parseArgs } from "./answers.js";
import { render } from "./render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "templates");

async function exists(filePath: string) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("UI preset answers", () => {
  it("parses explicit UI presets", () => {
    expect(parseArgs(["node", "cli", "--ui=app"]).uiPreset).toBe("app");
    expect(parseArgs(["node", "cli", "--ui-preset", "minimal"]).uiPreset).toBe(
      "minimal"
    );
  });

  it("defaults non-interactive scaffolds to the site preset", () => {
    const answers = applyDefaults(
      { projectName: "preset-default", yes: true },
      ["node", "cli"]
    );

    expect(answers.uiPreset).toBe("site");
  });
});

describe("UI preset rendering", () => {
  it("renders minimal projects without site-only component files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-minimal-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "minimal-app",
        targetDir: outDir,
        uiPreset: "minimal",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    expect(await exists(path.join(outDir, "components/ui/button.tsx"))).toBe(true);
    expect(await exists(path.join(outDir, "components/ui/accordion.tsx"))).toBe(false);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies["@radix-ui/react-accordion"]).toBeUndefined();
    expect(packageJson.dependencies["@radix-ui/react-label"]).toBeDefined();
  });

  it("renders site projects with page-builder component files and deps", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-site-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "site-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    expect(await exists(path.join(outDir, "components/ui/accordion.tsx"))).toBe(true);
    expect(await exists(path.join(outDir, "components/ui/table.tsx"))).toBe(true);
    expect(await exists(path.join(outDir, "components/ui/select.tsx"))).toBe(false);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies["@radix-ui/react-accordion"]).toBeDefined();
    expect(packageJson.dependencies["@radix-ui/react-select"]).toBeUndefined();
  });
});

