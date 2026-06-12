import { describe, expect, it } from "vitest";

import { _internal } from "./notion.js";

describe("default blog schema helpers", () => {
  it("maps minimal blog fields to the correct Notion property types", () => {
    const properties = _internal.buildProperties([
      { key: "title", notionName: "Name" },
      { key: "slug", notionName: "Slug" },
      { key: "description", notionName: "Description" },
      { key: "published", notionName: "Published" },
      { key: "date", notionName: "Date" },
      { key: "tags", notionName: "Tags" },
      { key: "cover", notionName: "Cover" },
    ]);

    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Slug).toEqual({ rich_text: {} });
    expect(properties.Description).toEqual({ rich_text: {} });
    expect(properties.Published).toEqual({ checkbox: {} });
    expect(properties.Date).toEqual({ date: {} });
    expect(properties.Tags).toEqual({ multi_select: {} });
    expect(properties.Cover).toEqual({ files: {} });
  });

  it("resolves the actual title property name from returned schema", () => {
    const name = _internal.resolveTitlePropertyName({
      Description: { rich_text: {} },
      Name: { title: {} },
      Slug: { rich_text: {} },
    });

    expect(name).toBe("Name");
  });
});

describe("sample page builders", () => {
  it("builds a published sample post plus page body blocks", () => {
    const page = _internal.buildSamplePage({
      index: 1,
      titlePropertyName: "Name",
      databaseId: "db-id",
      title: "my-app Blog",
      fieldNames: {
        title: "Name",
        slug: "Slug",
        description: "Description",
        published: "Published",
        date: "Date",
        tags: "Tags",
        cover: "Cover",
      },
    });
    const properties = page.properties as {
      Name: { title: Array<{ text: { content: string } }> };
      Published: { checkbox: boolean };
    };

    expect(properties.Name.title[0].text.content).toContain("Sample Post 1");
    expect(properties.Published.checkbox).toBe(true);
    expect(
      page.children.some((block: { type: string }) => block.type === "heading_1")
    ).toBe(true);
    expect(
      page.children.some(
        (block: { type: string }) => block.type === "bulleted_list_item"
      )
    ).toBe(true);
  });
});

describe("site-settings builders", () => {
  it("emits a schema that mirrors the runtime loader's field map", () => {
    const properties = _internal.buildSiteSettingsProperties();

    expect(properties["Site Name"]).toEqual({ title: {} });
    expect(properties.Tagline).toEqual({ rich_text: {} });
    expect(properties.Description).toEqual({ rich_text: {} });
    expect(properties["Default Locale"]).toEqual({ select: {} });
    expect(properties["Social Image"]).toEqual({ url: {} });
  });

  it("builds a seed row pre-populated with the project name", () => {
    const seed = _internal.buildSiteSettingsSeedPage({
      projectName: "digwis",
      description: "A demo description.",
      defaultLocale: "en",
      databaseId: "db-id",
    });
    const properties = seed.properties as {
      "Site Name": { title: Array<{ text: { content: string } }> };
      Tagline: { rich_text: Array<{ text: { content: string } }> };
      Description: { rich_text: Array<{ text: { content: string } }> };
      "Default Locale": { select: { name: string } };
    };

    expect(properties["Site Name"].title[0].text.content).toBe("digwis");
    expect(properties.Tagline.rich_text[0].text.content).toBe("digwis");
    expect(properties.Description.rich_text[0].text.content).toBe(
      "A demo description."
    );
    expect(properties["Default Locale"].select.name).toBe("en");
    expect(seed.parent).toEqual({ type: "database_id", database_id: "db-id" });
  });
});
