import { describe, expect, it } from "vitest";
import * as notionx from "./index";

describe("public exports", () => {
  it("exports locale-aware content helpers from root", () => {
    expect(typeof notionx.listGenericNotionContentForLocale).toBe("function");
    expect(typeof notionx.getGenericNotionContentBySlugForLocale).toBe(
      "function"
    );
  });
});
