// packages/nextion/tests/locale-contract/locale-switcher.test.ts
import { describe, expect, it } from "vitest";
import { blogContract } from "../../src/locale-contract/built-in";
import { buildLocaleSwitcherLinks } from "../../src/locale-contract/locale-switcher";

describe("buildLocaleSwitcherLinks", () => {
  it("links to the same detail in each supported locale when a translation exists", () => {
    const links = buildLocaleSwitcherLinks({
      contract: blogContract,
      currentLocale: "en",
      defaultLocale: "en",
      currentSlug: "hello",
      supportedLocales: ["en", "zh-CN"],
      translations: [
        { locale: "en", slug: "hello", sourcePageId: "src-1" },
        { locale: "zh-CN", slug: "ni-hao", sourcePageId: "src-1" },
      ],
    });
    expect(links).toEqual([
      { locale: "en", href: "/blog/hello" },
      { locale: "zh-CN", href: "/zh-CN/blog/ni-hao" },
    ]);
  });

  it("falls back to the localized list when a detail translation is missing", () => {
    const links = buildLocaleSwitcherLinks({
      contract: blogContract,
      currentLocale: "en",
      defaultLocale: "en",
      currentSlug: "hello",
      supportedLocales: ["en", "zh-CN"],
      translations: [{ locale: "en", slug: "hello", sourcePageId: "src-1" }],
    });
    expect(links).toEqual([
      { locale: "en", href: "/blog/hello" },
      { locale: "zh-CN", href: "/zh-CN/blog" },
    ]);
  });
});
