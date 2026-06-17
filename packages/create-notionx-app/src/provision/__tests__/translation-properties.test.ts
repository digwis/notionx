import { describe, expect, it } from "vitest";
import {
  buildBlogTranslationProperties,
  buildPageTranslationProperties,
  buildBlockTranslationProperties,
  buildSiteSettingsTranslationProperties,
  ensureTranslationDatabase,
} from "../notion.js";

describe("translation property builders", () => {
  it("buildBlogTranslationProperties includes Source relation, Locale select, Title, Slug, Body", () => {
    const props = buildBlogTranslationProperties();
    expect(props.Source).toEqual({ relation: { database_property: {} } });
    expect(props.Locale).toEqual({ select: {} });
    expect(props.Title).toEqual({ title: {} });
    expect(props.Slug).toEqual({ rich_text: {} });
    expect(props.Body).toEqual({ rich_text: {} });
    expect(props.Published).toEqual({ checkbox: {} });
    expect(props.Description).toEqual({ rich_text: {} });
  });

  it("buildPageTranslationProperties includes Nav Label and Footer Label", () => {
    const props = buildPageTranslationProperties();
    expect(props["Nav Label"]).toEqual({ rich_text: {} });
    expect(props["Footer Label"]).toEqual({ rich_text: {} });
  });

  it("buildBlockTranslationProperties includes Eyebrow, Headline, Subheadline, CTAs", () => {
    const props = buildBlockTranslationProperties();
    expect(props.Eyebrow).toEqual({ rich_text: {} });
    expect(props.Headline).toEqual({ rich_text: {} });
    expect(props["Primary CTA Label"]).toEqual({ rich_text: {} });
    expect(props["Primary CTA Href"]).toEqual({ url: {} });
  });

  it("buildSiteSettingsTranslationProperties includes Tagline, Nav Labels, Footer Labels", () => {
    const props = buildSiteSettingsTranslationProperties();
    expect(props.Tagline).toEqual({ rich_text: {} });
    expect(props["Nav Labels"]).toEqual({ rich_text: {} });
    expect(props["Footer Labels"]).toEqual({ rich_text: {} });
  });

  it("ensureTranslationDatabase is exported", () => {
    expect(typeof ensureTranslationDatabase).toBe("function");
  });
});

describe("build*TranslationProperties with baseDatabaseId", () => {
  const baseDbId = "abc123-base-db-id";

  it("buildBlogTranslationProperties links Source to base database", () => {
    const props = buildBlogTranslationProperties(baseDbId);
    expect(props.Source).toEqual({
      relation: { single_property: { database_id: baseDbId } },
    });
  });

  it("buildPageTranslationProperties links Source to base database", () => {
    const props = buildPageTranslationProperties(baseDbId);
    expect(props.Source).toEqual({
      relation: { single_property: { database_id: baseDbId } },
    });
  });

  it("buildBlockTranslationProperties links Source to base database", () => {
    const props = buildBlockTranslationProperties(baseDbId);
    expect(props.Source).toEqual({
      relation: { single_property: { database_id: baseDbId } },
    });
  });

  it("buildSiteSettingsTranslationProperties links Source to base database", () => {
    const props = buildSiteSettingsTranslationProperties(baseDbId);
    expect(props.Source).toEqual({
      relation: { single_property: { database_id: baseDbId } },
    });
  });

  it("falls back to database_property when baseDatabaseId is undefined", () => {
    expect(buildBlogTranslationProperties().Source).toEqual({
      relation: { database_property: {} },
    });
    expect(buildBlogTranslationProperties(undefined).Source).toEqual({
      relation: { database_property: {} },
    });
  });
});
