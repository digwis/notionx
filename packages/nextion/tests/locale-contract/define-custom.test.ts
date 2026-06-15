// packages/nextion/tests/locale-contract/define-custom.test.ts
import { describe, expect, it } from "vitest";
import {
  clearLocalizedRegistryForTests,
  defineLocaleContract,
  getRegisteredLocalizedSource,
} from "../../src/locale-contract/define";

describe("defineLocaleContract", () => {
  it("registers a custom model with sensible defaults", () => {
    clearLocalizedRegistryForTests();
    const contract = defineLocaleContract({
      id: "products",
      baseSourceName: "products",
      translationSourceName: "product-translations",
      listPath: "/products",
      baseFields: { title: "Name", sku: "SKU" },
      translationFields: {
        locale: "Locale",
        slug: "Slug",
        title: "Title",
        description: "Description",
      },
    });
    expect(contract.id).toBe("products");
    expect(contract.fallback).toBe("default-locale");
    expect(contract.detailParam).toBe("slug");
    expect(getRegisteredLocalizedSource("products")?.listPath).toBe(
      "/products"
    );
  });

  it("honors the override options (fallback, detailParam)", () => {
    clearLocalizedRegistryForTests();
    const contract = defineLocaleContract({
      id: "events",
      baseSourceName: "events",
      translationSourceName: "event-translations",
      listPath: "/events",
      baseFields: {},
      translationFields: {},
      fallback: "hide",
      detailParam: "eventId",
    });
    expect(contract.fallback).toBe("hide");
    expect(contract.detailParam).toBe("eventId");
  });

  it("replaces an existing registration when the same id is registered twice", () => {
    clearLocalizedRegistryForTests();
    defineLocaleContract({
      id: "products",
      baseSourceName: "products",
      translationSourceName: "product-translations",
      listPath: "/products",
      baseFields: {},
      translationFields: {},
    });
    defineLocaleContract({
      id: "products",
      baseSourceName: "products",
      translationSourceName: "product-translations",
      listPath: "/shop",
      baseFields: {},
      translationFields: {},
    });
    expect(getRegisteredLocalizedSource("products")?.listPath).toBe("/shop");
  });
});
