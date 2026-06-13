import { beforeEach, describe, expect, it, vi } from "vitest";

const { runNtnMock, runOrThrowNtnMock } = vi.hoisted(() => ({
  runNtnMock: vi.fn(),
  runOrThrowNtnMock: vi.fn(),
}));

vi.mock("./shell.js", () => ({
  runNtn: runNtnMock,
  runOrThrowNtn: runOrThrowNtnMock,
}));

import { _internal, ensureNotionDatabase } from "./notion.js";

describe("stable scaffold markers", () => {
  it("builds the expected scaffold marker for a stable key", () => {
    expect(_internal.buildScaffoldMarker("content:blog")).toBe(
      "[nextion-scaffold] key=content:blog"
    );
  });

  it("extracts a stable key from description text", () => {
    expect(
      _internal.extractScaffoldKey(
        "Editorial notes\n[nextion-scaffold] key=pages:default"
      )
    ).toBe("pages:default");
  });

  it("appends a scaffold marker without removing user-authored description text", () => {
    expect(
      _internal.mergeDescriptionWithScaffoldMarker(
        "Editorial notes",
        "content:blog"
      )
    ).toBe("Editorial notes\n[nextion-scaffold] key=content:blog");
  });
});

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
      Slug: { rich_text: Array<{ text: { content: string } }> };
      Published: { checkbox: boolean };
      Cover: { files: Array<{ type: string }> };
    };

    expect(properties.Name.title[0].text.content).toBe(
      "Building a Calm Publishing Workflow"
    );
    expect(properties.Slug.rich_text[0].text.content).toBe(
      "building-a-calm-publishing-workflow"
    );
    expect(properties.Published.checkbox).toBe(true);
    expect(properties.Cover.files[0].type).toBe("external");
    expect(
      page.children.some((block: { type: string }) => block.type === "heading_1")
    ).toBe(true);
    expect(
      page.children.some(
        (block: { type: string }) => block.type === "bulleted_list_item"
      )
    ).toBe(true);
  });

  it("uses localized sample copy for zh-CN projects", () => {
    const page = _internal.buildSamplePage({
      index: 1,
      titlePropertyName: "Name",
      databaseId: "db-id",
      title: "my-app Blog",
      locale: "zh-CN",
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
      Tags: { multi_select: Array<{ name: string }> };
    };

    expect(properties.Name.title[0].text.content).toBe(
      "建立一个不打扰创作的发布流程"
    );
    expect(properties.Tags.multi_select[0].name).toBe("工作流");
  });

  it("builds Pages database properties and a navigation-aware home page", () => {
    const properties = _internal.buildPageProperties();
    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Key).toEqual({ rich_text: {} });
    expect(properties["Show in Nav"]).toEqual({ checkbox: {} });
    expect(properties["Nav Order"]).toEqual({ number: {} });

    const [home] = _internal.sampleSitePages({
      apiToken: "token",
      parentPageId: "page",
      projectName: "Demo",
      contentSourceId: "blog",
      contentSourceTitle: "Blog",
      contentSourceListPath: "/blog",
      locale: "en",
    });
    const payload = _internal.buildSitePagePayload({
      databaseId: "db-id",
      projectName: "Demo",
      page: home,
    });
    const pageProperties = payload.properties as {
      Key: { rich_text: Array<{ text: { content: string } }> };
      Layout: { select: { name: string } };
      "Show Header": { checkbox: boolean };
    };

    expect(pageProperties.Key.rich_text[0].text.content).toBe("home");
    expect(pageProperties.Layout.select.name).toBe("home");
    expect(pageProperties["Show Header"].checkbox).toBe(true);
  });
});

describe("stable database reuse", () => {
  beforeEach(() => {
    runNtnMock.mockReset();
    runOrThrowNtnMock.mockReset();
  });

  it("reuses a database whose description already contains the stable key", async () => {
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        results: [
          {
            object: "database",
            id: "db-stable",
            title: [{ plain_text: "Renamed Blog" }],
            description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
            parent: { page_id: "page-1234-page-1234-page-1234page1234" },
            data_sources: [{ id: "ds-stable" }],
            url: "https://www.notion.so/db-stable",
            last_edited_time: "2026-06-12T00:00:00.000Z",
          },
        ],
      })
    );
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({ properties: { Name: { title: {} } } })
    );

    const result = await ensureNotionDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      title: "Demo Blog",
      stableKey: "content:blog",
      locale: "en",
      fields: [{ key: "title", notionName: "Name" }],
      seedCount: 3,
    });

    expect(result.created).toBe(false);
    expect(result.databaseId).toBe("db-stable");
    expect(runOrThrowNtnMock).not.toHaveBeenCalledWith(
      expect.arrayContaining(["v1/databases", "-d", expect.any(String)]),
      expect.anything()
    );
  });

  it("upgrades a legacy title match by patching the scaffold marker", async () => {
    runOrThrowNtnMock
      .mockResolvedValueOnce(JSON.stringify({ results: [] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          results: [
            {
              object: "database",
              id: "db-legacy",
              title: [{ plain_text: "Demo Blog" }],
              description: [],
              parent: { page_id: "page-1234-page-1234-page-1234page1234" },
              data_sources: [{ id: "ds-legacy" }],
              url: "https://www.notion.so/db-legacy",
            },
          ],
        })
      )
      .mockResolvedValueOnce(JSON.stringify({ properties: { Name: { title: {} } } }))
      .mockResolvedValueOnce(JSON.stringify({ id: "db-legacy" }));

    const result = await ensureNotionDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      title: "Demo Blog",
      stableKey: "content:blog",
      locale: "en",
      fields: [{ key: "title", notionName: "Name" }],
      seedCount: 0,
    });

    expect(result.created).toBe(false);
    expect(runOrThrowNtnMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "v1/databases/db-legacy", "-X", "PATCH"]),
      expect.objectContaining({ env: { NOTION_API_TOKEN: "token" } })
    );
  });

  it("selects the most recently edited database when duplicate stable markers exist", async () => {
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        results: [
          {
            object: "database",
            id: "db-older",
            title: [{ plain_text: "Older" }],
            description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
            parent: { page_id: "page-1234-page-1234-page-1234page1234" },
            data_sources: [{ id: "ds-older" }],
            last_edited_time: "2026-06-01T00:00:00.000Z",
          },
          {
            object: "database",
            id: "db-newer",
            title: [{ plain_text: "Newer" }],
            description: [{ plain_text: "[nextion-scaffold] key=content:blog" }],
            parent: { page_id: "page-1234-page-1234-page-1234page1234" },
            data_sources: [{ id: "ds-newer" }],
            last_edited_time: "2026-06-12T00:00:00.000Z",
          },
        ],
      })
    );
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({ properties: { Name: { title: {} } } })
    );

    const result = await ensureNotionDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      title: "Demo Blog",
      stableKey: "content:blog",
      fields: [{ key: "title", notionName: "Name" }],
      seedCount: 0,
    });

    expect(result.databaseId).toBe("db-newer");
  });
});

describe("schema patch guardrails", () => {
  it("does not patch property types when the existing schema type differs", () => {
    const diff = _internal.missingPropertiesForPatch(
      { Published: { rich_text: {} } },
      { Published: { checkbox: {} }, Date: { date: {} } }
    );

    expect(diff.properties).toEqual({ Date: { date: {} } });
    expect(diff.warnings[0]).toContain('property "Published" is rich_text');
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
