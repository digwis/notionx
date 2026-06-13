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

describe("template token substitution", () => {
  it("replaces {{nextionSource}} with a real semver in the generated package.json", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-tokens-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "tokens-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        nextionSource: "^1.2.3",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const raw = await fs.readFile(path.join(outDir, "package.json"), "utf8");

    // The literal token must not survive — pnpm install would fail
    // with an invalid version specifier.
    expect(raw).not.toContain("{{nextionSource}}");

    const packageJson = JSON.parse(raw) as {
      dependencies: Record<string, string>;
    };
    // The substituted value must be a valid npm semver/range.
    expect(packageJson.dependencies["@notionx/core"]).toBe("^1.2.3");
  });

  it("writes .dev.vars.example as part of the rendered project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-devvars-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "devvars-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const devVarsExample = await fs.readFile(
      path.join(outDir, ".dev.vars.example"),
      "utf8"
    );

    // Every key that writeDevVars() expects to update must be present
    // as a declared line, otherwise the wiring step throws ENOENT.
    for (const key of [
      "D1_DATABASE_ID",
      "KV_NAMESPACE_ID",
      "TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
      "NOTION_TOKEN",
      "NOTION_DATA_SOURCE_ID",
      "NOTION_PAGES_DATA_SOURCE_ID",
      "NOTION_SITE_SETTINGS_DATA_SOURCE_ID",
      "RESEND_API_KEY",
      "RESEND_FROM",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      expect(devVarsExample).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });
});

describe("request-scoped env access (AsyncLocalStorage pattern)", () => {
  it("renders lib/site/request-env.ts with the AsyncLocalStorage helpers", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-als-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "als-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const requestEnv = await fs.readFile(
      path.join(outDir, "lib/site/request-env.ts"),
      "utf8"
    );

    // The shim must use Node's AsyncLocalStorage (the only way we
    // can thread Cloudflare's per-request `env` to deeply-nested
    // helpers without a real `getRequestContext` from workerd).
    expect(requestEnv).toMatch(/from\s+["']node:async_hooks["']/);
    expect(requestEnv).toMatch(/AsyncLocalStorage/);
    expect(requestEnv).toMatch(/export\s+function\s+runWithRequestEnv/);
    expect(requestEnv).toMatch(/export\s+function\s+getRequestEnv/);
  });

  it("lib/site/settings.ts no longer imports getRequestContext from cloudflare:workers", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-settings-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "settings-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const settings = await fs.readFile(
      path.join(outDir, "lib/site/settings.ts"),
      "utf8"
    );

    // The previous import triggered a workerd SyntaxError at boot
    // ("The requested module 'cloudflare:workers' does not provide
    // an export named 'getRequestContext'"), which crashed deploy.
    // The fix replaces it with `getRequestEnv()` from the local
    // AsyncLocalStorage shim.
    expect(settings).not.toMatch(
      /import\s+\{\s*getRequestContext\s*\}\s+from\s+["']cloudflare:workers["']/
    );
    expect(settings).toMatch(/from\s+["']\.\/request-env["']/);
    expect(settings).toMatch(/getRequestEnv\(\)/);
  });

  it("worker/index.ts wraps the fetch handler in runWithRequestEnv()", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "nextion-worker-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "worker-app",
        targetDir: outDir,
        uiPreset: "site",
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const worker = await fs.readFile(path.join(outDir, "worker/index.ts"), "utf8");

    // The worker must call runWithRequestEnv(env, ...) so that
    // AsyncLocalStorage is populated for the request lifetime.
    expect(worker).toMatch(/import\s+\{\s*runWithRequestEnv\s*\}\s+from/);
    expect(worker).toMatch(/runWithRequestEnv\(\s*env\s*,/);
  });
});

