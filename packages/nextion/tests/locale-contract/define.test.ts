// packages/nextion/tests/locale-contract/define.test.ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import {
  clearLocalizedRegistryForTests,
  defineLocalizedContentSource,
  getLocalizedContracts,
  getRegisteredLocalizedSource,
} from "../../src/locale-contract/define";

describe("defineLocalizedContentSource", () => {
  it("registers the contract and returns it unchanged", () => {
    clearLocalizedRegistryForTests();
    const returned = defineLocalizedContentSource({
      ...blogContract,
      listPath: "/articles",
    });
    expect(returned.id).toBe("blog");
    expect(getRegisteredLocalizedSource("blog")?.listPath).toBe("/articles");
    expect(getLocalizedContracts().map((c) => c.id)).toContain("blog");
  });

  it("is idempotent on id (last write wins)", () => {
    clearLocalizedRegistryForTests();
    defineLocalizedContentSource({ ...blogContract, listPath: "/a" });
    defineLocalizedContentSource({ ...blogContract, listPath: "/b" });
    expect(getRegisteredLocalizedSource("blog")?.listPath).toBe("/b");
    expect(getLocalizedContracts().filter((c) => c.id === "blog")).toHaveLength(1);
  });
});
