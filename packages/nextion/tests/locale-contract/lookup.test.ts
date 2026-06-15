// packages/nextion/tests/locale-contract/lookup.test.ts
import { describe, expect, it } from "vitest";
import {
  blogContract,
  blocksContract,
  pagesContract,
} from "../../src/locale-contract/built-in";
import {
  pickTranslation,
  pickTranslationOrDefault,
  hideWhenMissing,
} from "../../src/locale-contract/lookup";

type Translation = { locale: string; slug: string; title: string; published: boolean };

const en: Translation = { locale: "en", slug: "hello", title: "Hello", published: true };
const zh: Translation = { locale: "zh-CN", slug: "ni-hao", title: "你好", published: true };

describe("pickTranslation", () => {
  it("returns the matching translation when present", () => {
    expect(pickTranslation([en, zh], "zh-CN", blogContract, "en")?.locale).toBe("zh-CN");
  });

  it("returns null when the locale is missing and rule is strict-missing", () => {
    expect(pickTranslation([en], "zh-CN", pagesContract, "en")).toBeNull();
  });

  it("returns null when the locale is missing and rule is hide", () => {
    expect(pickTranslation([en], "zh-CN", blogContract, "en")).toBeNull();
  });

  it("falls back to the default-locale translation when rule is default-locale", () => {
    expect(pickTranslation([en], "zh-CN", blocksContract, "en")?.locale).toBe("en");
  });
});

describe("pickTranslationOrDefault", () => {
  it("returns the default-locale entry as a last-resort fallback for any rule", () => {
    expect(pickTranslationOrDefault([en], "zh-CN", "en", pagesContract)).toEqual(en);
  });
});

describe("hideWhenMissing", () => {
  it("filters out translations that do not match the requested locale", () => {
    expect(hideWhenMissing([en, zh], "zh-CN")).toEqual([zh]);
  });
});
