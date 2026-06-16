import { describe, expect, it } from "vitest";

import { classifyFileOwnership, toUnifiedUpdateRisk } from "./ownership.js";

describe("ownership-aware update classification", () => {
  const managedFiles = {
    platformManaged: ["package.json", "wrangler.jsonc"],
    bridge: ["worker/index.ts"],
    userOwned: ["app/blog/page.tsx", "components/site/site-header.tsx"],
  };

  it("marks platform-managed files as safe", () => {
    expect(classifyFileOwnership("package.json", managedFiles)).toBe("platformManaged");
    expect(
      toUnifiedUpdateRisk({
        filePath: "package.json",
        status: "updated",
        managedFiles,
      })
    ).toBe("safe");
  });

  it("marks bridge files as review and user-owned files as conflict", () => {
    expect(classifyFileOwnership("worker/index.ts", managedFiles)).toBe("bridge");
    expect(
      toUnifiedUpdateRisk({
        filePath: "worker/index.ts",
        status: "updated",
        managedFiles,
      })
    ).toBe("review");
    expect(
      toUnifiedUpdateRisk({
        filePath: "app/blog/page.tsx",
        status: "updated",
        managedFiles,
      })
    ).toBe("conflict");
  });
});
