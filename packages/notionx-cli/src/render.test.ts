import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { applyDefaults } from "./answers.js";
import { MONOREPO_PROTOCOL } from "./notionx-source.js";
import { render, resolveStarterTemplatesDir } from "./render.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "templates", "blog");

async function exists(filePath: string) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("rendering", () => {
  it("resolves the named starter directory under templates/", async () => {
    const dir = await resolveStarterTemplatesDir("blog");
    expect(dir.split(path.sep).join("/")).toMatch(/templates\/blog$/);
    expect(await exists(path.join(dir, "package.json.tmpl"))).toBe(true);
  });

  it("always ships the site preset (no UI preset prompt in CLI)", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-render-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "render-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );
    await render(answers, templatesDir, outDir);
    expect(await exists(path.join(outDir, "components/ui/accordion.tsx"))).toBe(true);
    expect(await exists(path.join(outDir, "components/ui/button.tsx"))).toBe(true);
    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies["@radix-ui/react-accordion"]).toBeDefined();
    expect(packageJson.dependencies["@radix-ui/react-label"]).toBeDefined();
  });

  it("ships a replaceable default favicon", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-app-icon-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "icon-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const icon = await fs.readFile(path.join(outDir, "public/favicon.svg"), "utf8");
    const layout = await fs.readFile(path.join(outDir, "app/layout.tsx"), "utf8");
    const manifest = JSON.parse(
      await fs.readFile(path.join(outDir, ".notionx/registry.json"), "utf8")
    ) as {
      managedFiles: {
        user: string[];
      };
    };

    expect(icon).toContain("Notionx site icon");
    expect(layout).toContain('url: "/favicon.svg"');
    expect(manifest.managedFiles.user).toContain("public/favicon.svg");
  });
});

describe("template token substitution", () => {
  it("writes a v2 registry.json manifest into .notionx", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-manifests-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "manifest-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const manifest = JSON.parse(
      await fs.readFile(path.join(outDir, ".notionx/registry.json"), "utf8")
    ) as {
      $schema: string;
      projectKind: string;
      projectName: string;
      installed: Array<{
        id: string;
        kind: string;
        version: number;
        params: Record<string, string>;
      }>;
      managedFiles: {
        platform: string[];
        bridge: string[];
        user: string[];
      };
    };

    expect(manifest.$schema).toBe(
      "https://notionx.dev/schemas/registry.v2.json",
    );
    expect(manifest.projectName).toBe("manifest-app");
    expect(manifest.installed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "blog",
          kind: "content-source",
          version: 1,
          params: { contentSourceId: "blog" },
        }),
        expect.objectContaining({
          id: "site-settings",
          kind: "feature-module",
        }),
        expect.objectContaining({
          id: "blocks",
          kind: "feature-module",
        }),
        expect.objectContaining({
          id: "auth",
          kind: "feature-module",
        }),
        expect.objectContaining({
          id: "admin",
          kind: "feature-module",
        }),
        expect.objectContaining({
          id: "pages",
          kind: "feature-module",
        }),
        expect.objectContaining({
          id: "search",
          kind: "feature-module",
        }),
      ]),
    );
    expect(manifest.installed).toHaveLength(7);
    expect(manifest.managedFiles.platform).toContain("package.json");
    expect(manifest.managedFiles.bridge).toContain("worker/index.ts");
    expect(manifest.managedFiles.bridge).toContain("lib/site/settings.ts");
    expect(manifest.managedFiles.bridge).toContain(
      "components/page-blocks.tsx",
    );
    expect(manifest.managedFiles.bridge).toContain("lib/auth.config.ts");
    expect(manifest.managedFiles.bridge).toContain("app/admin/layout.tsx");
    expect(manifest.managedFiles.bridge).toContain("lib/pages/source.ts");
    expect(manifest.managedFiles.bridge).toContain("lib/search/config.ts");
    expect(manifest.managedFiles.user).toContain("app/blog/page.tsx");
  });

  it("replaces {{notionxSource}} with a real semver in the generated package.json", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-tokens-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "tokens-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        notionxSource: "^1.2.3",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const raw = await fs.readFile(path.join(outDir, "package.json"), "utf8");

    // The literal token must not survive — pnpm install would fail
    // with an invalid version specifier.
    expect(raw).not.toContain("{{notionxSource}}");

    const packageJson = JSON.parse(raw) as {
      dependencies: Record<string, string>;
    };
    // The substituted value must be a valid npm semver/range.
    expect(packageJson.dependencies["@notionx/core"]).toBe("^1.2.3");
  });

  it("writes .dev.vars.example as part of the rendered project", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-devvars-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "devvars-app",
        targetDir: outDir,
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
      "NOTION_BLOCKS_DATA_SOURCE_ID",
      "RESEND_API_KEY",
      "RESEND_FROM",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      expect(devVarsExample).toMatch(new RegExp(`^${key}=`, "m"));
    }
  });

  it("renders the verified vinext versions into package.json", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-vinext-versions-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "vinext-versions-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as {
      devDependencies: Record<string, string>;
    };

    expect(packageJson.devDependencies.vinext).toBe("^0.1.4");
    expect(packageJson.devDependencies["@vinext/cloudflare"]).toBe("^0.1.2");
  });

  it("renders the first-phase blocks wiring into config and content templates", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-blocks-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "blocks-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const wrangler = await fs.readFile(path.join(outDir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain("NOTION_BLOCKS_DATA_SOURCE_ID");

    const models = await fs.readFile(
      path.join(outDir, "lib/content/models.ts"),
      "utf8"
    );
    expect(models).toContain('id: "blocks"');
    expect(models).toContain('dataSourceEnv: "NOTION_BLOCKS_DATA_SOURCE_ID"');

    const pagesSource = await fs.readFile(
      path.join(outDir, "lib/pages/source.ts"),
      "utf8"
    );
    expect(pagesSource).toContain("getPageBlocks");
    expect(pagesSource).toContain("structuredBlocks");
  });

  it("renders typed structured block mapping into lib/pages/source.ts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-typed-blocks-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "typed-blocks-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const source = await fs.readFile(path.join(outDir, "lib/pages/source.ts"), "utf8");
    expect(source).toContain('variant: "hero"');
    expect(source).toContain('variant: "feature-grid"');
    expect(source).toContain('variant: "latest-posts"');
    expect(source).toContain("blocks: NotionBlock[]");
    expect(source).toContain("mapGenericBlockToStructuredBlock");
  });

  it("renders dedicated structured block component files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-page-block-components-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "page-block-components-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const hero = await fs.readFile(
      path.join(outDir, "components/page-blocks/hero-block.tsx"),
      "utf8"
    );
    const featureGrid = await fs.readFile(
      path.join(outDir, "components/page-blocks/feature-grid-block.tsx"),
      "utf8"
    );
    const story = await fs.readFile(
      path.join(outDir, "components/page-blocks/story-block.tsx"),
      "utf8"
    );

    expect(hero).toContain("export function HeroBlock");
    expect(featureGrid).toContain("export function FeatureGridBlock");
    expect(story).toContain("export function StoryBlock");
  });

  it("renders three homepage fallback structured blocks with semantic names", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-homepage-fallbacks-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "homepage-fallbacks-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const source = await fs.readFile(path.join(outDir, "lib/pages/source.ts"), "utf8");
    expect(source).toContain('slug: "home-hero"');
    expect(source).toContain('slug: "home-feature-grid"');
    expect(source).toContain('slug: "home-latest-posts"');
    expect(source).toContain('{ slug: "home-latest-posts" }');
    // Fallback blocks carry content as Notion page body blocks.
    expect(source).toContain("Start with a homepage you can keep editing");
  });

  it("renders a latest-posts page block component and removes the extra homepage hero copy", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-latest-posts-block-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "latest-posts-block-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const home = await fs.readFile(path.join(outDir, "app/page.tsx"), "utf8");
    const pageBlocks = await fs.readFile(
      path.join(outDir, "components/page-blocks.tsx"),
      "utf8"
    );
    const latestPosts = await fs.readFile(
      path.join(outDir, "components/page-blocks/latest-posts-block.tsx"),
      "utf8"
    );

    expect(pageBlocks).toContain("LatestPostsBlock");
    expect(latestPosts).toContain("export async function LatestPostsBlock");
    expect(home).not.toContain("Notion Pages + Cloudflare Workers");
  });

  it("renders a shared post card component for blog grids", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-post-card-grid-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "post-card-grid-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const blogIndex = await fs.readFile(path.join(outDir, "app/blog/page.tsx"), "utf8");
    const latestPosts = await fs.readFile(
      path.join(outDir, "components/page-blocks/latest-posts-block.tsx"),
      "utf8"
    );
    const postCard = await fs.readFile(
      path.join(outDir, "components/content/post-card.tsx"),
      "utf8"
    );

    expect(postCard).toContain("export function PostCard");
    expect(blogIndex).toContain("PostCard");
    expect(blogIndex).toContain("md:grid-cols-2");
    expect(blogIndex).toContain("xl:grid-cols-3");
    expect(latestPosts).toContain("PostCard");
  });

  it("renders fallback navigation with home, about, and blog defaults", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-nav-defaults-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "nav-defaults-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const siteConfig = await fs.readFile(path.join(outDir, "lib/site/config.ts"), "utf8");
    const pagesSource = await fs.readFile(path.join(outDir, "lib/pages/source.ts"), "utf8");

    expect(siteConfig).toContain('label: "Home"');
    expect(siteConfig).toContain('label: "About"');
    expect(siteConfig).toContain('label: "Blog"');
    expect(siteConfig).toContain("picsum.photos");
    expect(pagesSource).toContain('key: "about"');
    expect(pagesSource).toContain('slug: "about"');
    expect(pagesSource).toContain('title: "About"');
    expect(pagesSource).toContain('slug: "privacy"');
  });

  it("reads runtime site settings in the site header and footer", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-runtime-site-settings-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "runtime-site-settings-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const header = await fs.readFile(
      path.join(outDir, "components/site/site-header.tsx"),
      "utf8"
    );
    const footer = await fs.readFile(
      path.join(outDir, "components/site/site-footer.tsx"),
      "utf8"
    );

    expect(header).toContain("getSiteSettings");
    expect(header).toContain("settings.navigation.cta");
    expect(header).toContain("settings.name");
    expect(footer).toContain("getSiteSettings");
    expect(footer).toContain("settings.footer.social");
    expect(footer).toContain("settings.footer.tagline");
  });
});

describe("request-scoped env access (AsyncLocalStorage pattern)", () => {
  it("renders lib/site/request-env.ts with the AsyncLocalStorage helpers", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-als-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "als-app",
        targetDir: outDir,
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
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-settings-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "settings-app",
        targetDir: outDir,
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
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-worker-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "worker-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const worker = await fs.readFile(path.join(outDir, "worker/index.ts"), "utf8");

    // The worker must call runWithRequestEnv(...) so that
    // AsyncLocalStorage is populated for the request lifetime.
    expect(worker).toMatch(/import\s+\{\s*runWithRequestEnv\s*\}\s+from/);
    // The locale prefix middleware sets `x-notionx-locale`; the worker
    // threads it into the request env as `NOTIONX_LOCALE` alongside
    // the original `env`.
    expect(worker).toMatch(/request\.headers\.get\(["']x-notionx-locale["']\)/);
    expect(worker).toMatch(/runWithRequestEnv\(\s*\{\s*\.\.\.env/);
    expect(worker).toMatch(/NOTIONX_LOCALE:\s*locale/);
  });
});

describe("scaffolded project ships the Notionx CLI as a devDependency", () => {
  it("uses workspace:* for @notionx/cli in monorepo dev mode", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-devdep-workspace-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "devdep-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        notionxSource: MONOREPO_PROTOCOL,
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies!["@notionx/cli"]).toBe(
      MONOREPO_PROTOCOL
    );
  });

  it("pins @notionx/cli to the CLI package version, not notionxSource", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "notionx-devdep-"));
    const outDir = path.join(root, "app");
    const answers = applyDefaults(
      {
        projectName: "devdep-app",
        targetDir: outDir,
        adminEmail: "admin@example.com",
        adminPassword: "Password123",
        notionxSource: "^9.9.9",
        yes: true,
      },
      ["node", "cli"]
    );

    await render(answers, templatesDir, outDir);

    const packageJson = JSON.parse(
      await fs.readFile(path.join(outDir, "package.json"), "utf8")
    ) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    // The scaffolder CLI ships as a devDependency so that
    // `pnpm exec notionx update` and `pnpm exec notionx provision repair`
    // work inside the rendered project without having to reach for
    // `pnpm dlx` (which requires the user to know the package name).
    expect(packageJson.devDependencies).toHaveProperty(
      "@notionx/cli"
    );

    // The version must be a real semver, not the unsubstituted
    // `{{notionxSource}}` token (which would be the case if the
    // template's token map was incomplete).
    const version = packageJson.devDependencies!["@notionx/cli"];
    expect(version).not.toContain("{{");
    expect(version).not.toContain("}}");
    expect(version).toMatch(/^\^?\d+\.\d+\.\d+/);

    const scaffolderPackage = JSON.parse(
      await fs.readFile(path.resolve(__dirname, "..", "package.json"), "utf8")
    ) as { version: string };

    // The runtime dep follows notionxSource, but the scaffolder CLI
    // must stay pinned to the actual published CLI version so the
    // generated project never references a non-existent npm release.
    const coreDep = packageJson.dependencies!["@notionx/core"];
    expect(coreDep).toBe("^9.9.9");
    expect(version).toBe(`^${scaffolderPackage.version}`);
  });
});
