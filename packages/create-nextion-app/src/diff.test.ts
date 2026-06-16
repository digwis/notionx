import { describe, expect, it } from "vitest";

import type { LoadedRegistry } from "./registry/registry-types.js";
import {
  buildDiffSummary,
  formatDiffSummary,
  formatUpgradePreview,
} from "./diff.js";

const baseRegistry: LoadedRegistry = {
  manifest: {
    $schema: "https://nextion.dev/schemas/registry.v2.json",
    projectKind: "nextion",
    projectName: "demo",
    scaffoldVersion: "1.0.0",
    nextionCore: "^2.0.0",
    defaultLocale: "en",
    supportedLocales: ["en"],
    enableSiteSettings: true,
    enableBlocks: true,
    enableAuth: true,
    enableAdmin: true,
    enablePages: true,
    enableSearch: true,
    contentSource: {
      id: "blog",
      title: "Blog",
      fields: [{ key: "title", notionName: "Title" }],
    },
    compat: { mode: "v2-native" },
    registries: {},
    installed: [
      {
        id: "blog",
        kind: "content-source",
        version: 1,
        source: { kind: "official", name: "@notionx/official" },
        params: { contentSourceId: "blog" },
        installedAt: "2026-06-15T00:00:00.000Z",
      },
    ],
    managedFiles: {
      platform: ["package.json", "wrangler.jsonc"],
      bridge: ["worker/index.ts"],
      user: ["app/blog/page.tsx", "components/site/site-header.tsx"],
    },
  },
  managedFiles: {
    platform: ["package.json", "wrangler.jsonc"],
    bridge: ["worker/index.ts"],
    user: ["app/blog/page.tsx", "components/site/site-header.tsx"],
  },
};

describe("diff summary", () => {
  it("summarizes installed items and ownership counts", () => {
    const summary = buildDiffSummary({ registry: baseRegistry });

    expect(summary.installed).toEqual(["blog@1"]);
    expect(summary.ownership).toEqual({
      platform: 2,
      bridge: 1,
      user: 2,
    });
  });

  it("formats a readable diff summary", () => {
    expect(
      formatDiffSummary({
        installed: ["blog@1"],
        ownership: {
          platform: 2,
          bridge: 1,
          user: 2,
        },
      })
    ).toEqual([
      "installed:",
      "  - blog@1",
      "ownership:",
      "  - platform: 2",
      "  - bridge: 1",
      "  - user: 2",
    ]);
  });

  it("formats an upgrade preview grouped by risk", () => {
    expect(
      formatUpgradePreview({
        safe: ["file:package.json"],
        review: ["file:worker/index.ts"],
        conflict: ["file:app/blog/page.tsx"],
      })
    ).toEqual([
      "upgrade preview:",
      "  safe:",
      "    - file:package.json",
      "  review:",
      "    - file:worker/index.ts",
      "  conflict:",
      "    - file:app/blog/page.tsx",
    ]);
  });
});
