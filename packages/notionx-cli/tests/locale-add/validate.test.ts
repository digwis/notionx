// packages/notionx-cli/tests/locale-add/validate.test.ts
import { describe, expect, it } from "vitest";
import { validateLocaleAdd } from "../../src/locale-add/validate";

describe("validateLocaleAdd", () => {
  it("accepts a well-formed, non-duplicate locale", () => {
    const result = validateLocaleAdd({
      locale: "zh-CN",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result).toEqual({ ok: true, locale: "zh-CN" });
  });

  it("normalizes casing for the region part", () => {
    const result = validateLocaleAdd({
      locale: "zh-cn",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result).toEqual({ ok: true, locale: "zh-CN" });
  });

  it("rejects a locale that is already in the list (no removals)", () => {
    const result = validateLocaleAdd({
      locale: "en",
      supportedLocales: ["en", "zh-CN"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already/);
  });

  it("rejects a locale that equals the default locale", () => {
    const result = validateLocaleAdd({
      locale: "en",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects malformed locales", () => {
    const result = validateLocaleAdd({
      locale: "not_a_locale!!",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects empty input", () => {
    const result = validateLocaleAdd({
      locale: "  ",
      supportedLocales: ["en"],
      defaultLocale: "en",
    });
    expect(result.ok).toBe(false);
  });
});
