import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadProjectContext } from "./project-context.js";

describe("loadProjectContext", () => {
  it("loads scaffold, installation, and managed-files metadata", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nextion-context-"));
    await mkdir(path.join(root, ".nextion"), { recursive: true });

    await writeFile(
      path.join(root, ".nextion/scaffold.json"),
      JSON.stringify({
        projectKind: "nextion",
        projectName: "demo",
        scaffoldVersion: "0.7.2",
        defaultLocale: "en",
        supportedLocales: ["en"],
        nextionSource: "^1.0.0",
        enableSiteSettings: true,
        contentSource: {
          id: "blog",
          title: "Blog",
          fields: [{ key: "title", notionName: "Title" }],
        },
      })
    );
    await writeFile(
      path.join(root, ".nextion/installations.json"),
      JSON.stringify({
        templates: [
          {
            name: "blog",
            kind: "site-template",
            version: 1,
            params: { contentSourceId: "blog" },
          },
        ],
        modules: [],
      })
    );
    await writeFile(
      path.join(root, ".nextion/managed-files.json"),
      JSON.stringify({
        platformManaged: ["package.json"],
        bridge: ["worker/index.ts"],
        userOwned: ["app/blog/page.tsx"],
      })
    );

    const context = await loadProjectContext(root);

    expect(context.installations.templates[0]?.name).toBe("blog");
    expect(context.managedFiles.bridge).toContain("worker/index.ts");
    expect(context.managedFiles.userOwned).toContain("app/blog/page.tsx");
  });
});
