import { beforeEach, describe, expect, it, vi } from "vitest";

const { runNtnMock, runOrThrowNtnMock } = vi.hoisted(() => ({
  runNtnMock: vi.fn(),
  runOrThrowNtnMock: vi.fn(),
}));

vi.mock("./shell.js", () => ({
  runNtn: runNtnMock,
  runOrThrowNtn: runOrThrowNtnMock,
}));

import { _internal, ensureNotionDatabase, ensureSiteSettingsDatabase } from "./notion.js";

describe("stable scaffold markers", () => {
  it("builds the expected scaffold marker for a stable key", () => {
    expect(_internal.buildScaffoldMarker("content:blog")).toBe(
      "[notionx-scaffold] key=content:blog"
    );
  });

  it("extracts a stable key from description text", () => {
    expect(
      _internal.extractScaffoldKey(
        "Editorial notes\n[notionx-scaffold] key=pages:default"
      )
    ).toBe("pages:default");
  });

  it("appends a scaffold marker without removing user-authored description text", () => {
    expect(
      _internal.mergeDescriptionWithScaffoldMarker(
        "Editorial notes",
        "content:blog"
      )
    ).toBe("Editorial notes\n[notionx-scaffold] key=content:blog");
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
    // Blocks is a Notion relation to the Blocks database (unlinked
    // when no blocksDatabaseId is provided).
    expect(properties.Blocks).toEqual({ relation: { database_property: {} } });
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
    const pageProperties = payload.properties as unknown as {
      Key: { rich_text: Array<{ text: { content: string } }> };
      Layout: { select: { name: string } };
      "Show Header": { checkbox: boolean };
      Blocks?: { relation: Array<{ id: string }> };
    };

    expect(pageProperties.Key.rich_text[0].text.content).toBe("home");
    expect(pageProperties.Layout.select.name).toBe("home");
    // Without blockPageIdsBySlug, the Blocks relation is omitted
    // (no relation to set on the page).
    expect(pageProperties.Blocks).toBeUndefined();
    expect(pageProperties["Show Header"].checkbox).toBe(true);
  });

  it("sets Blocks relation when blockPageIdsBySlug is provided", () => {
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
      blockPageIdsBySlug: {
        "home-hero": "block-id-1",
        "home-feature-grid": "block-id-2",
        "home-latest-posts": "block-id-3",
      },
    });
    const pageProperties = payload.properties as unknown as {
      Blocks: { relation: Array<{ id: string }> };
    };
    expect(pageProperties.Blocks.relation).toEqual([
      { id: "block-id-1" },
      { id: "block-id-2" },
      { id: "block-id-3" },
    ]);
  });

  it("seeds a semantic homepage with three homepage blocks", () => {
    const pages = _internal.sampleSitePages({
      apiToken: "token",
      parentPageId: "page",
      projectName: "newpj",
      contentSourceId: "blog",
      contentSourceTitle: "Blog",
      contentSourceListPath: "/blog",
      locale: "en",
    });

    const home = pages.find((page) => page.key === "home");
    expect(home?.title).toBe("Home");
    expect(home?.blocks).toEqual([
      { slug: "home-hero", variant: "hero", order: 10 },
      { slug: "home-feature-grid", variant: "feature-grid", order: 20 },
      { slug: "home-latest-posts", order: 30 },
    ]);
  });
});

describe("blocks data source builders", () => {
  it("exposes a minimal 6-field schema and starter rows for reusable page blocks", () => {
    const helpers = _internal as unknown as {
      buildBlocksProperties?: () => Record<string, unknown>;
      sampleBlocks?: (input: {
        projectName: string;
        contentSourceTitle: string;
        locale?: string;
      }) => Array<{ slug: string; type: string; name: string }>;
    };

    expect(typeof helpers.buildBlocksProperties).toBe("function");
    expect(typeof helpers.sampleBlocks).toBe("function");

    const properties = helpers.buildBlocksProperties?.() ?? {};
    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Slug).toEqual({ rich_text: {} });
    expect(properties.Type).toEqual({ select: {} });
    expect(properties.Order).toEqual({ number: {} });
    expect(properties.Cover).toEqual({ files: {} });
    expect(properties.Published).toEqual({ checkbox: {} });
    // The wide content fields are gone — content lives in page body.
    expect(properties.Eyebrow).toBeUndefined();
    expect(properties.Headline).toBeUndefined();
    expect(properties.Body).toBeUndefined();
    expect(properties["Page Keys"]).toBeUndefined();

    const blocks =
      helpers.sampleBlocks?.({
        projectName: "Demo",
        contentSourceTitle: "Blog",
        locale: "en",
      }) ?? [];
    expect(blocks.map((block) => block.slug)).toEqual(
      expect.arrayContaining(["home-hero", "home-feature-grid", "home-latest-posts"])
    );
    expect(blocks.find((block) => block.slug === "home-hero")?.type).toBe("hero");
  });

  it("builds a minimal 6-field schema with no content property fields", () => {
    const properties = _internal.buildBlocksProperties();

    expect(Object.keys(properties)).toHaveLength(6);
    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Slug).toEqual({ rich_text: {} });
    expect(properties.Type).toEqual({ select: {} });
    expect(properties.Order).toEqual({ number: {} });
    expect(properties.Cover).toEqual({ files: {} });
    expect(properties.Published).toEqual({ checkbox: {} });
  });

  it("seeds semantic homepage blocks and excludes about-story", () => {
    const blocks = _internal.sampleBlocks({
      projectName: "newpj",
      contentSourceTitle: "Blog",
      locale: "en",
    });

    expect(blocks.map((block) => block.name)).toEqual([
      "Homepage Hero",
      "Homepage Feature Grid",
      "Homepage Latest Posts",
    ]);
    expect(blocks.map((block) => block.slug)).not.toContain("about-story");
  });

  it("seeds hero block content as Notion page body children blocks", () => {
    const [hero] = _internal.sampleBlocks({
      projectName: "Demo",
      contentSourceTitle: "Blog",
      locale: "en",
    });
    const payload = _internal.buildSiteBlockPayload({
      databaseId: "db-id",
      projectName: "Demo",
      block: hero,
    });
    const properties = payload.properties as unknown as {
      Name: { title: Array<{ text: { content: string } }> };
      Type: { select: { name: string } };
      Order: { number: number };
      Published: { checkbox: boolean };
    };

    expect(properties.Name.title[0]?.text.content).toBe("Homepage Hero");
    expect(properties.Type.select.name).toBe("hero");
    expect(properties.Order.number).toBe(10);
    expect(properties.Published.checkbox).toBe(true);

    // Content is written as Notion children blocks, not property fields.
    expect(payload.children.length).toBeGreaterThan(0);
    expect(
      payload.children.some(
        (block: Record<string, unknown>) => block.type === "heading_1"
      )
    ).toBe(true);
    expect(
      payload.children.some(
        (block: Record<string, unknown>) => block.type === "paragraph"
      )
    ).toBe(true);
  });
});

describe("default content and site settings seeds", () => {
  it("seeds six published blog posts by default", () => {
    const helpers = _internal as typeof _internal & {
      samplePosts?: (locale?: string) => Array<{ slug: string; title: string }>;
    };

    expect(typeof helpers.samplePosts).toBe("function");
    const posts = helpers.samplePosts?.("en") ?? [];

    expect(posts).toHaveLength(6);
    expect(posts.every((post) => Boolean(post.slug))).toBe(true);
  });

  it("seeds site settings with nav, footer, and icon defaults", () => {
    const pages = _internal.buildSiteSettingsSeedPages({
      projectName: "newpj",
      description: "An editable site",
      defaultLocale: "en",
      dataSourceId: "site-settings-ds",
    });
    const byKey: Record<string, (typeof pages)[number]> = {};
    for (const page of pages) {
      const props = page.properties as {
        Key: { rich_text: Array<{ text: { content: string } }> };
      };
      const key = props.Key.rich_text[0]?.text.content ?? "";
      byKey[key] = page;
    }

    const navProps = byKey.items!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(navProps.Value.rich_text[0]?.text.content).toContain('"label":"Home"');
    expect(navProps.Value.rich_text[0]?.text.content).toContain('"label":"About"');
    expect(navProps.Value.rich_text[0]?.text.content).toContain('"label":"Blog"');

    const footerProps = byKey.columns!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(footerProps.Value.rich_text[0]?.text.content).toContain(
      '"label":"Company"'
    );

    const socialProps = byKey.socialImage!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(socialProps.Value.rich_text[0]?.text.content).toContain("picsum.photos");

    const ogProps = byKey.ogImage!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(ogProps.Value.rich_text[0]?.text.content).toContain("picsum.photos");
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
            description: [{ plain_text: "[notionx-scaffold] key=content:blog" }],
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
            description: [{ plain_text: "[notionx-scaffold] key=content:blog" }],
            parent: { page_id: "page-1234-page-1234-page-1234page1234" },
            data_sources: [{ id: "ds-older" }],
            last_edited_time: "2026-06-01T00:00:00.000Z",
          },
          {
            object: "database",
            id: "db-newer",
            title: [{ plain_text: "Newer" }],
            description: [{ plain_text: "[notionx-scaffold] key=content:blog" }],
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

describe("site-settings reuse", () => {
  beforeEach(() => {
    runNtnMock.mockReset();
    runOrThrowNtnMock.mockReset();
  });

  it("reuses a data source whose description carries the site-settings stable key", async () => {
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        results: [
          {
            object: "data_source",
            id: "ds-stable",
            title: [{ plain_text: "digwis Site Settings" }],
            description: [{ plain_text: "[notionx-scaffold] key=site-settings" }],
            parent: { database_id: "db-stable" },
            data_sources: [{ id: "ds-stable" }],
            url: "https://www.notion.so/db-stable",
            last_edited_time: "2026-06-12T00:00:00.000Z",
          },
        ],
      })
    );
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        properties: {
          Name: { title: {} },
          Section: { select: {} },
          Key: { rich_text: {} },
          Value: { rich_text: {} },
          Type: { select: {} },
          Published: { checkbox: {} },
        },
      })
    );

    const result = await ensureSiteSettingsDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      projectName: "digwis",
      description: "desc",
      defaultLocale: "en",
    });

    expect(result.reused).toBe(true);
    expect(result.dataSourceId).toBe("ds-stable");
    expect(runOrThrowNtnMock).not.toHaveBeenCalledWith(
      expect.arrayContaining(["v1/databases", "-d", expect.any(String)]),
      expect.anything()
    );
  });

  it("falls back to a title match when no stable-key marker is present", async () => {
    // First call: stable-key search returns nothing.
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ results: [] }));
    // Second call: title search returns a same-named data source.
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        results: [
          {
            object: "data_source",
            id: "ds-legacy",
            title: [{ plain_text: "digwis Site Settings" }],
            description: [],
            parent: { database_id: "db-legacy" },
            data_sources: [{ id: "ds-legacy" }],
            url: "https://www.notion.so/db-legacy",
            last_edited_time: "2026-06-12T00:00:00.000Z",
          },
        ],
      })
    );
    // Third call: ensureDataSourceProperties → getDataSourceSchema
    // (all 6 properties present → no PATCH needed).
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        properties: {
          Name: { title: {} },
          Section: { select: {} },
          Key: { rich_text: {} },
          Value: { rich_text: {} },
          Type: { select: {} },
          Published: { checkbox: {} },
        },
      })
    );
    // Fourth call: patchDatabaseDescription (marker missing on legacy row).
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ id: "db-legacy" }));

    const result = await ensureSiteSettingsDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      projectName: "digwis",
      description: "desc",
      defaultLocale: "en",
    });

    expect(result.reused).toBe(true);
    expect(result.dataSourceId).toBe("ds-legacy");
    expect(runOrThrowNtnMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "v1/databases/db-legacy", "-X", "PATCH"]),
      expect.objectContaining({ env: { NOTION_API_TOKEN: "token" } })
    );
  });

  it("creates a fresh data source and writes the stable-key marker when nothing matches", async () => {
    // No stable-key match.
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ results: [] }));
    // No title match.
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ results: [] }));
    // createDatabaseWithProperties (databases endpoint).
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        id: "db-new",
        data_sources: [{ id: "ds-new" }],
        url: "https://www.notion.so/db-new",
      })
    );
    // createDatabaseWithProperties PATCH (adds the 5 non-title
    // properties to the new data source).
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({ properties: {} })
    );
    // patchDatabaseDescription (description contains the stable key marker).
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ id: "db-new" }));
    // seed page inserts (uses runNtn, not runOrThrowNtn) — one per row.
    const seedCount = 16;
    for (let i = 0; i < seedCount; i++) {
      runNtnMock.mockResolvedValueOnce({
        code: 0,
        stdout: JSON.stringify({ id: `page-new-${i}`, object: "page" }),
        stderr: "",
      });
    }

    const result = await ensureSiteSettingsDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      projectName: "digwis",
      description: "desc",
      defaultLocale: "en",
    });

    expect(result.reused).toBe(false);
    expect(result.seeded).toBe(seedCount);
    expect(result.dataSourceId).toBe("ds-new");

    // The description PATCH payload must include the scaffold marker.
    const patchCall = runOrThrowNtnMock.mock.calls.find(
      (call) =>
        Array.isArray(call[0]) &&
        (call[0] as string[]).includes("v1/databases/db-new") &&
        (call[0] as string[]).includes("PATCH")
    );
    expect(patchCall).toBeDefined();
    const bodyArg = (patchCall![0] as string[])[5];
    const description = JSON.parse(bodyArg).description as Array<{
      text: { content: string };
    }>;
    expect(description[0].text.content).toContain(
      "[notionx-scaffold] key=site-settings"
    );
  });
});

describe("site-settings builders", () => {
  it("emits a 6-property multi-row key-value schema", () => {
    const properties = _internal.buildSiteSettingsProperties();
    const keys = Object.keys(properties);
    expect(keys).toHaveLength(6);
    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Section).toEqual({ select: {} });
    expect(properties.Key).toEqual({ rich_text: {} });
    expect(properties.Value).toEqual({ rich_text: {} });
    expect(properties.Type).toEqual({ select: {} });
    expect(properties.Published).toEqual({ checkbox: {} });
  });

  it("seeds one page per setting item with Section/Key/Value/Type", () => {
    const seeds = _internal.buildSiteSettingsSeedPages({
      projectName: "digwis",
      description: "A demo description.",
      defaultLocale: "en",
      dataSourceId: "ds-id",
    });
    expect(seeds).toHaveLength(16);

    // Every seed uses data_source_id as parent.
    for (const seed of seeds) {
      expect(seed.parent).toEqual({
        type: "data_source_id",
        data_source_id: "ds-id",
      });
    }

    // The "name" row carries the project name as its Value.
    const nameRow = seeds.find((s) => {
      const props = s.properties as {
        Key: { rich_text: Array<{ text: { content: string } }> };
      };
      return props.Key.rich_text[0]?.text.content === "name";
    });
    expect(nameRow).toBeDefined();
    const nameProps = nameRow!.properties as {
      Name: { title: Array<{ text: { content: string } }> };
      Section: { select: { name: string } };
      Value: { rich_text: Array<{ text: { content: string } }> };
      Type: { select: { name: string } };
      Published: { checkbox: boolean };
    };
    expect(nameProps.Name.title[0].text.content).toBe("Site Name");
    expect(nameProps.Section.select.name).toBe("branding");
    expect(nameProps.Value.rich_text[0].text.content).toBe("digwis");
    expect(nameProps.Type.select.name).toBe("text");
    expect(nameProps.Published.checkbox).toBe(true);

    // The "items" row carries the default nav JSON.
    const itemsRow = seeds.find((s) => {
      const props = s.properties as {
        Key: { rich_text: Array<{ text: { content: string } }> };
      };
      return props.Key.rich_text[0]?.text.content === "items";
    });
    expect(itemsRow).toBeDefined();
    const itemsProps = itemsRow!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    const parsed = JSON.parse(itemsProps.Value.rich_text[0].text.content);
    expect(parsed[0]).toEqual({ label: "Home", href: "/" });

    // The "primaryColor" row carries the default theme color.
    const colorRow = seeds.find((s) => {
      const props = s.properties as {
        Key: { rich_text: Array<{ text: { content: string } }> };
      };
      return props.Key.rich_text[0]?.text.content === "primaryColor";
    });
    expect(colorRow).toBeDefined();
    const colorProps = colorRow!.properties as {
      Value: { rich_text: Array<{ text: { content: string } }> };
    };
    expect(colorProps.Value.rich_text[0].text.content).toBe("blue");
  });
});
