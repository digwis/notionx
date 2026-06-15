// packages/nextion/tests/locale-contract/built-in.test.ts
import { describe, expect, it } from "vitest";
import {
  blogContract,
  blocksContract,
  pagesContract,
  siteSettingsContract,
} from "../../src/locale-contract/built-in";

describe("built-in locale contracts", () => {
  it("declares a stable id and base/translation source names", () => {
    expect(blogContract.id).toBe("blog");
    expect(blogContract.baseSourceName).toBe("blog");
    expect(blogContract.translationSourceName).toBe("blog-translations");
  });

  it("exposes field maps for every built-in model", () => {
    expect(Object.keys(pagesContract.baseFields)).toEqual(
      expect.arrayContaining(["title", "key", "layout", "showInNav"])
    );
    expect(Object.keys(pagesContract.translationFields)).toEqual(
      expect.arrayContaining(["locale", "slug", "title", "navLabel"])
    );
    expect(Object.keys(blocksContract.translationFields)).toEqual(
      expect.arrayContaining(["eyebrow", "headline", "body"])
    );
    expect(
      Object.keys(siteSettingsContract.translationFields)
    ).toEqual(expect.arrayContaining(["tagline", "footerLabels"]));
  });
});
