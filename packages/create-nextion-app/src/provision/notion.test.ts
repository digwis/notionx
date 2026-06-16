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
    expect(properties.Blocks).toEqual({ rich_text: {} });
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
      Blocks: { rich_text: Array<{ text: { content: string } }> };
      "Show Header": { checkbox: boolean };
    };

    expect(pageProperties.Key.rich_text[0].text.content).toBe("home");
    expect(pageProperties.Layout.select.name).toBe("home");
    const blocks = pageProperties.Blocks as {
      rich_text: Array<{ text: { content: string } }>;
    };
    expect(blocks.rich_text[0].text.content).toContain('"slug":"home-hero"');
    expect(pageProperties["Show Header"].checkbox).toBe(true);
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
  it("exposes a dedicated schema and starter rows for reusable page blocks", () => {
    const helpers = _internal as unknown as {
      buildBlocksProperties?: () => Record<string, unknown>;
      sampleBlocks?: (input: {
        projectName: string;
        contentSourceTitle: string;
        locale?: string;
      }) => Array<{ slug: string; type: string; pageKeys: string[] }>;
    };

    expect(typeof helpers.buildBlocksProperties).toBe("function");
    expect(typeof helpers.sampleBlocks).toBe("function");

    const properties = helpers.buildBlocksProperties?.() ?? {};
    expect(properties.Name).toEqual({ title: {} });
    expect(properties.Slug).toEqual({ rich_text: {} });
    expect(properties.Type).toEqual({ select: {} });
    expect(properties["Page Keys"]).toEqual({ rich_text: {} });
    expect(properties.Order).toEqual({ number: {} });

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
    expect(blocks.find((block) => block.slug === "home-hero")?.pageKeys).toContain(
      "home"
    );
  });

  it("builds typed block properties for hero, feature-grid, and story", () => {
    const properties = _internal.buildBlocksProperties();

    expect(properties.Type).toEqual({ select: {} });
    expect(properties.Eyebrow).toEqual({ rich_text: {} });
    expect(properties.Headline).toEqual({ rich_text: {} });
    expect(properties.Subheadline).toEqual({ rich_text: {} });
    expect(properties["Primary CTA Label"]).toEqual({ rich_text: {} });
    expect(properties["Primary CTA Href"]).toEqual({ url: {} });
    expect(properties["Secondary CTA Label"]).toEqual({ rich_text: {} });
    expect(properties["Secondary CTA Href"]).toEqual({ url: {} });
    expect(properties.Alignment).toEqual({ select: {} });
    expect(properties.Theme).toEqual({ select: {} });
    expect(properties.Columns).toEqual({ number: {} });
    expect(properties.Items).toEqual({ rich_text: {} });
    expect(properties.Body).toEqual({ rich_text: {} });
    expect(properties.Quote).toEqual({ rich_text: {} });
    expect(properties["Quote Attribution"]).toEqual({ rich_text: {} });
    expect(properties["Media Url"]).toEqual({ url: {} });
    expect(properties.Layout).toEqual({ select: {} });
  });

  it("seeds semantic homepage blocks and excludes about-story", () => {
    const blocks = _internal.sampleBlocks({
      projectName: "newpj",
      contentSourceTitle: "Blog",
      locale: "en",
    });

    expect(blocks.map((block) => block.title)).toEqual([
      "Homepage Hero",
      "Homepage Feature Grid",
      "Homepage Latest Posts",
    ]);
    expect(blocks.map((block) => block.slug)).not.toContain("about-story");
  });

  it("seeds hero blocks from structured fields instead of page body content", () => {
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
      Type: { select: { name: string } };
      Headline: { rich_text: Array<{ text: { content: string } }> };
      "Primary CTA Label": { rich_text: Array<{ text: { content: string } }> };
      "Primary CTA Href": { url: string };
      Alignment: { select: { name: string } };
    };

    expect(properties.Type.select.name).toBe("hero");
    expect(properties.Headline.rich_text[0]?.text.content).toBeTruthy();
    expect(properties["Primary CTA Label"].rich_text[0]?.text.content).toBeTruthy();
    expect(properties["Primary CTA Href"].url).toMatch(/^\//);
    expect(properties.Alignment.select.name).toBe("center");
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
    const payload = _internal.buildSiteSettingsSeedPage({
      projectName: "newpj",
      description: "An editable site",
      defaultLocale: "en",
      dataSourceId: "site-settings-ds",
    });
    const properties = payload.properties as unknown as {
      Nav: { rich_text: Array<{ text: { content: string } }> };
      "Footer Columns": { rich_text: Array<{ text: { content: string } }> };
      "Social Image": { url: string | null };
      "OG Image": { url: string | null };
    };

    expect(properties.Nav.rich_text[0]?.text.content).toContain('"label":"Home"');
    expect(properties.Nav.rich_text[0]?.text.content).toContain('"label":"About"');
    expect(properties.Nav.rich_text[0]?.text.content).toContain('"label":"Blog"');
    expect(properties["Footer Columns"].rich_text[0]?.text.content).toContain(
      '"label":"Company"'
    );
    expect(properties["Social Image"].url).toContain("picsum.photos");
    expect(properties["OG Image"].url).toContain("picsum.photos");
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
          "Site Name": { title: {} },
          Tagline: { rich_text: {} },
          Description: { rich_text: {} },
          "Default Locale": { select: {} },
          "Social Image": { url: {} },
          "Meta Title": { rich_text: {} },
          "Meta Description": { rich_text: {} },
          "OG Image": { url: {} },
          Nav: { rich_text: {} },
          "Nav CTA": { rich_text: {} },
          "Primary Color": { select: {} },
          "Accent Color": { select: {} },
          "Font Family": { select: {} },
          "Footer Columns": { rich_text: {} },
          "Footer Copyright": { rich_text: {} },
          "Footer Social Links": { rich_text: {} },
          "Footer Tagline": { rich_text: {} },
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
    // (all 17 properties present → no PATCH needed).
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({
        properties: {
          "Site Name": { title: {} },
          Tagline: { rich_text: {} },
          Description: { rich_text: {} },
          "Default Locale": { select: {} },
          "Social Image": { url: {} },
          "Meta Title": { rich_text: {} },
          "Meta Description": { rich_text: {} },
          "OG Image": { url: {} },
          Nav: { rich_text: {} },
          "Nav CTA": { rich_text: {} },
          "Primary Color": { select: {} },
          "Accent Color": { select: {} },
          "Font Family": { select: {} },
          "Footer Columns": { rich_text: {} },
          "Footer Copyright": { rich_text: {} },
          "Footer Social Links": { rich_text: {} },
          "Footer Tagline": { rich_text: {} },
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
    // createDatabaseWithProperties PATCH (adds the 4 non-title
    // properties to the new data source).
    runOrThrowNtnMock.mockResolvedValueOnce(
      JSON.stringify({ properties: {} })
    );
    // patchDatabaseDescription (description contains the stable key marker).
    runOrThrowNtnMock.mockResolvedValueOnce(JSON.stringify({ id: "db-new" }));
    // seed page insert (uses runNtn, not runOrThrowNtn).
    runNtnMock.mockResolvedValueOnce({ code: 0, stdout: JSON.stringify({ id: "page-new", object: "page" }), stderr: "" });

    const result = await ensureSiteSettingsDatabase({
      apiToken: "token",
      parentPageId: "page-1234-page-1234-page-1234page1234",
      projectName: "digwis",
      description: "desc",
      defaultLocale: "en",
    });

    expect(result.reused).toBe(false);
    expect(result.seeded).toBe(1);
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
  it("emits a 17-property schema covering the full editor surface", () => {
    const properties = _internal.buildSiteSettingsProperties();
    const keys = Object.keys(properties);
    expect(keys).toHaveLength(17);
    // Existing 5
    expect(properties["Site Name"]).toEqual({ title: {} });
    expect(properties.Tagline).toEqual({ rich_text: {} });
    expect(properties.Description).toEqual({ rich_text: {} });
    expect(properties["Default Locale"]).toEqual({ select: {} });
    expect(properties["Social Image"]).toEqual({ url: {} });
    // 12 new (SEO / Nav / Theme / Footer)
    expect(properties["Meta Title"]).toEqual({ rich_text: {} });
    expect(properties["Meta Description"]).toEqual({ rich_text: {} });
    expect(properties["OG Image"]).toEqual({ url: {} });
    expect(properties.Nav).toEqual({ rich_text: {} });
    expect(properties["Nav CTA"]).toEqual({ rich_text: {} });
    expect(properties["Primary Color"]).toEqual({ select: {} });
    expect(properties["Accent Color"]).toEqual({ select: {} });
    expect(properties["Font Family"]).toEqual({ select: {} });
    expect(properties["Footer Columns"]).toEqual({ rich_text: {} });
    expect(properties["Footer Copyright"]).toEqual({ rich_text: {} });
    expect(properties["Footer Social Links"]).toEqual({ rich_text: {} });
    expect(properties["Footer Tagline"]).toEqual({ rich_text: {} });
  });

  it("seeds the singleton row with all 17 properties", () => {
    const seed = _internal.buildSiteSettingsSeedPage({
      projectName: "digwis",
      description: "A demo description.",
      defaultLocale: "en",
      dataSourceId: "ds-id",
    });
    const properties = seed.properties as Record<string, unknown>;
    const titleProps = properties["Site Name"] as {
      title: Array<{ text: { content: string } }>;
    };
    expect(titleProps.title[0].text.content).toBe("digwis");
    const metaTitle = properties["Meta Title"] as {
      rich_text: Array<{ text: { content: string } }>;
    };
    expect(metaTitle.rich_text[0].text.content).toBe("digwis");
    const nav = properties.Nav as {
      rich_text: Array<{ text: { content: string } }>;
    };
    const parsed = JSON.parse(nav.rich_text[0].text.content);
    expect(parsed[0]).toEqual({ label: "Home", href: "/" });
    const theme = properties["Primary Color"] as {
      select: { name: string };
    };
    expect(theme.select.name).toBe("slate");
    const accent = properties["Accent Color"] as {
      select: { name: string };
    };
    expect(accent.select.name).toBe("blue");
    const font = properties["Font Family"] as {
      select: { name: string };
    };
    expect(font.select.name).toBe("inter");
    // Notion's 2025-09-03 schema requires `data_source_id` here.
    expect(seed.parent).toEqual({
      type: "data_source_id",
      data_source_id: "ds-id",
    });
  });
});
