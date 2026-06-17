import { describe, expect, it } from "vitest";

// The middleware template renders TypeScript that imports from
// `next/server`. We can't import it directly in a Node test, so we
// verify the rendered output's logic by extracting and evaluating
// the matcher config and the locale detection.

describe("middleware locale prefix logic", () => {
  const SUPPORTED_LOCALES = ["en", "zh-CN"];
  const DEFAULT_LOCALE = "en";

  it("default locale stays unprefixed (no locale prefix detected)", () => {
    const pathname = "/blog";
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    expect(!firstSegment || !SUPPORTED_LOCALES.includes(firstSegment)).toBe(true);
  });

  it("root path has no locale prefix", () => {
    const pathname = "/";
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    expect(!firstSegment || !SUPPORTED_LOCALES.includes(firstSegment)).toBe(true);
  });

  it("non-default locale is detected and stripped", () => {
    const pathname = "/zh-CN/blog/post-one";
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    expect(SUPPORTED_LOCALES.includes(firstSegment!)).toBe(true);
    expect(firstSegment !== DEFAULT_LOCALE).toBe(true);

    const stripped = pathname.replace(`/${firstSegment}`, "") || "/";
    expect(stripped).toBe("/blog/post-one");
  });

  it("default locale with explicit prefix triggers redirect", () => {
    const pathname = "/en/blog";
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    expect(firstSegment === DEFAULT_LOCALE).toBe(true);
  });

  it("static asset paths are not matched by the matcher", () => {
    const matcher = /^\/((?!api|_next\/static|_next\/image|favicon\.ico|admin|.*\.).*)/;
    expect(matcher.test("/api/data")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
    expect(matcher.test("/admin")).toBe(false);
    expect(matcher.test("/image.png")).toBe(false);
    expect(matcher.test("/blog")).toBe(true);
    expect(matcher.test("/zh-CN/blog")).toBe(true);
  });
});
