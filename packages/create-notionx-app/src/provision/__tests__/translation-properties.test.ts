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
