// packages/nextion/tests/locale-contract/paths.test.ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import {
  localizedListPath,
  localizedDetailPathFor,
  stripLocalePrefix,
} from "../../src/locale-contract/paths";

describe("localizedListPath", () => {
  it("keeps the default-locale list path unprefixed", () => {
    expect(localizedListPath("en", blogContract, "en")).toBe("/blog");
  });

  it("prefixes non-default-locale list paths with the locale", () => {
    expect(localizedListPath("zh-CN", blogContract, "en")).toBe("/zh-CN/blog");
  });
});

describe("localizedDetailPathFor", () => {
  it("joins the localized list path with the slug for the default locale", () => {
    expect(localizedDetailPathFor("en", "hello-world", blogContract, "en")).toBe(
      "/blog/hello-world"
    );
  });

  it("joins the localized list path with the slug for a non-default locale", () => {
    expect(localizedDetailPathFor("zh-CN", "hello-world", blogContract, "en")).toBe(
      "/zh-CN/blog/hello-world"
    );
  });
});

describe("stripLocalePrefix", () => {
  it("removes a known locale prefix from a path", () => {
    expect(stripLocalePrefix("/zh-CN/blog", "zh-CN")).toBe("/blog");
  });

  it("returns the path unchanged when no locale prefix is present", () => {
    expect(stripLocalePrefix("/blog", "zh-CN")).toBe("/blog");
  });
});
