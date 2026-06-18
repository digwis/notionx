import { describe, expect, it } from "vitest";
import {
  buildBlogTranslationProperties,
  buildPageTranslationProperties,
  buildBlockTranslationProperties,
  buildSiteSettingsTranslationProperties,
  ensureTranslationDatabase,
} from "../notion.js";

describe("translation property builders", () => {
  it("buildBlogTranslationProperties includes Source relation, Locale select, Title, Slug (no Body field)", () => {
    const props = buildBlogTranslationProperties();
    expect(props.Source).toEqual({ relation: {} });
    expect(props.Locale).toEqual({ select: {} });
    expect(props.Title).toEqual({ title: {} });
    expect(props.Slug).toEqual({ rich_text: {} });
    // Body content lives in the translation page's children blocks,
    // not a rich_text field — assert the property is absent.
    expect(props.Body).toBeUndefined();
    expect(props.Published).toEqual({ checkbox: {} });
    expect(props.Description).toEqual({ rich_text: {} });
  });

  it("buildPageTranslationProperties includes Nav Label and Footer Label (no Body field)", () => {
    const props = buildPageTranslationProperties();
    expect(props["Nav Label"]).toEqual({ rich_text: {} });
    expect(props["Footer Label"]).toEqual({ rich_text: {} });
    expect(props.Body).toBeUndefined();
  });

  it("buildBlockTranslationProperties includes only Title, Source, Locale, Published (no content fields)", () => {
    const props = buildBlockTranslationProperties();
    expect(props.Title).toEqual({ title: {} });
    expect(props.Locale).toEqual({ select: {} });
    expect(props.Published).toEqual({ checkbox: {} });
    // Body content lives in the translation page's children blocks,
    // not a rich_text field — assert the property is absent.
    expect(props.Body).toBeUndefined();
    expect(props.Eyebrow).toBeUndefined();
    expect(props.Headline).toBeUndefined();
    expect(props.Subheadline).toBeUndefined();
    expect(props["Primary CTA Label"]).toBeUndefined();
    expect(props["Primary CTA Href"]).toBeUndefined();
    expect(props.Quote).toBeUndefined();
  });

  it("buildSiteSettingsTranslationProperties includes Value (only translatable field)", () => {
    const props = buildSiteSettingsTranslationProperties();
    expect(props.Value).toEqual({ rich_text: {} });
    expect(props.Locale).toEqual({ select: {} });
    expect(props.Published).toEqual({ checkbox: {} });
    // Section, Key, Type are NOT translated — only Value is.
    expect(props.Tagline).toBeUndefined();
    expect(props["Nav Labels"]).toBeUndefined();
    expect(props["Footer Labels"]).toBeUndefined();
  });

  it("ensureTranslationDatabase is exported", () => {
    expect(typeof ensureTranslationDatabase).toBe("function");
  });
});

describe("build*TranslationProperties with baseDataSourceId", () => {
  const baseDsId = "abc123-base-ds-id";

  it("buildBlogTranslationProperties links Source to base data source", () => {
    const props = buildBlogTranslationProperties(baseDsId);
    expect(props.Source).toEqual({
      relation: { data_source_id: baseDsId },
    });
  });

  it("buildPageTranslationProperties links Source to base data source", () => {
    const props = buildPageTranslationProperties(baseDsId);
    expect(props.Source).toEqual({
      relation: { data_source_id: baseDsId },
    });
  });

  it("buildBlockTranslationProperties links Source to base data source", () => {
    const props = buildBlockTranslationProperties(baseDsId);
    expect(props.Source).toEqual({
      relation: { data_source_id: baseDsId },
    });
  });

  it("buildSiteSettingsTranslationProperties links Source to base data source", () => {
    const props = buildSiteSettingsTranslationProperties(baseDsId);
    expect(props.Source).toEqual({
      relation: { data_source_id: baseDsId },
    });
  });

  it("falls back to empty relation when baseDataSourceId is undefined", () => {
    expect(buildBlogTranslationProperties().Source).toEqual({
      relation: {},
    });
    expect(buildBlogTranslationProperties(undefined).Source).toEqual({
      relation: {},
    });
  });
});
