import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_TEMPLATE,
  buildDefaultInstallationManifest,
  buildDefaultManagedFilesManifest,
} from "./template-contracts.js";

describe("template contracts", () => {
  it("builds a default site template installation manifest", () => {
    const manifest = buildDefaultInstallationManifest({
      contentSourceId: "blog",
      siteTemplate: "blog",
    });

    expect(manifest.templates).toEqual([
      {
        name: "blog",
        kind: "site-template",
        version: 1,
        params: { contentSourceId: "blog" },
      },
    ]);
    expect(manifest.modules).toEqual([]);
  });

  it("classifies generated files into ownership buckets", () => {
    const managed = buildDefaultManagedFilesManifest({
      siteTemplate: DEFAULT_SITE_TEMPLATE,
    });

    expect(managed.platformManaged).toContain("package.json");
    expect(managed.platformManaged).toContain("wrangler.jsonc");
    expect(managed.bridge).toContain("worker/index.ts");
    expect(managed.userOwned).toContain("app/page.tsx");
    expect(managed.userOwned).toContain("components/site/site-header.tsx");
  });
});
