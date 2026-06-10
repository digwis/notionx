import { describe, it, expect } from "vitest";
import {
  supportedLocales,
  defaultLocale,
  isAppLocale,
  localizedMovieListPath,
  localizedMovieDetailPath,
  expandLocalizedMoviePaths,
} from "../../src/i18n/config";

describe("i18n config", () => {
  it("declares English and Chinese as supported locales", () => {
    expect(supportedLocales).toContain("zh-CN");
    expect(supportedLocales).toContain("en-US");
  });

  it("defaults to a supported locale", () => {
    expect(supportedLocales).toContain(defaultLocale);
  });

  it("identifies valid app locales", () => {
    expect(isAppLocale("zh-CN")).toBe(true);
    expect(isAppLocale("en-US")).toBe(true);
    expect(isAppLocale("fr-FR")).toBe(false);
  });
});

describe("localized movie path helpers", () => {
  it("prefixes the locale for the list and detail paths", () => {
    expect(localizedMovieListPath("zh-CN")).toBe("/zh-CN/movies");
    expect(localizedMovieDetailPath("en-US", "inception")).toBe(
      "/en-US/movies/inception"
    );
  });

  it("duplicates movie routes per locale when expanding paths", () => {
    expect(
      expandLocalizedMoviePaths(["/movies", "/movies/inception"], "zh-CN")
    ).toEqual(["/zh-CN/movies", "/zh-CN/movies/inception"]);
    expect(expandLocalizedMoviePaths(["/blog"])).toEqual(["/blog"]);
  });
});
