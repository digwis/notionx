import { describe, it, expect } from "vitest";
import {
  defineI18nConfig,
  expandLocalizedPaths,
  isSupportedLocale,
  localizedDetailPath,
  localizedPath,
} from "../../src/i18n/config";

const config = defineI18nConfig({
  supportedLocales: ["zh-CN", "en-US"] as const,
  defaultLocale: "zh-CN",
});

describe("i18n config", () => {
  it("declares supported locales", () => {
    expect(config.supportedLocales).toContain("zh-CN");
    expect(config.supportedLocales).toContain("en-US");
  });

  it("defaults to a supported locale", () => {
    expect(config.supportedLocales).toContain(config.defaultLocale);
  });

  it("identifies supported locales", () => {
    expect(isSupportedLocale(config, "zh-CN")).toBe(true);
    expect(isSupportedLocale(config, "en-US")).toBe(true);
    expect(isSupportedLocale(config, "fr-FR")).toBe(false);
  });
});

describe("localized path helpers", () => {
  it("prefixes the locale for the list and detail paths", () => {
    expect(localizedPath("zh-CN", "/docs")).toBe("/zh-CN/docs");
    expect(localizedDetailPath("en-US", "/movies", "inception")).toBe(
      "/en-US/movies/inception"
    );
  });

  it("duplicates selected routes per locale when expanding paths", () => {
    expect(
      expandLocalizedPaths({
        paths: ["/movies", "/movies/inception", "/blog"],
        config,
        locale: "zh-CN",
        shouldLocalize: (path) => path.startsWith("/movies"),
      })
    ).toEqual(["/zh-CN/movies", "/zh-CN/movies/inception", "/blog"]);
  });
});
