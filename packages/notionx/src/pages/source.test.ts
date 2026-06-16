import { describe, expect, it } from "vitest";
import {
  defaultSitePageFields,
  deriveSiteFooterGroups,
  deriveSiteNavigation,
  mapNotionPageToSitePage,
} from "./index";
import { createSitePagesApi } from "./source";
import type { NotionPageLike } from "../notion/types";
import type { SitePage } from "./types";

function richText(content: string) {
  return {
    type: "rich_text",
    rich_text: [{ plain_text: content }],
  };
}

function title(content: string) {
  return {
    type: "title",
    title: [{ plain_text: content }],
  };
}

describe("site pages", () => {
  it("maps Notion page properties into a renderable site page", () => {
    const page: NotionPageLike = {
      id: "page-id",
      properties: {
        Name: title("About"),
        Key: richText("about"),
        Slug: richText("about"),
        Status: { type: "select", select: { name: "Published" } },
        Layout: { type: "select", select: { name: "default" } },
        Description: richText("About this project"),
        "Show in Nav": { type: "checkbox", checkbox: true },
        "Nav Label": richText("About"),
        "Nav Order": { type: "number", number: 20 },
        "Show in Footer": { type: "checkbox", checkbox: true },
        "Footer Label": richText("About"),
        "Footer Group": { type: "select", select: { name: "Site" } },
        "Footer Order": { type: "number", number: 10 },
        Blocks: richText(
          JSON.stringify([
            { slug: "about-hero", variant: "hero", order: 1 },
            "about-story",
          ])
        ),
      },
    };

    const mapped = mapNotionPageToSitePage(page, defaultSitePageFields);

    expect(mapped?.key).toBe("about");
    expect(mapped?.href).toBe("/about");
    expect(mapped?.showHeader).toBe(true);
    expect(mapped?.showFooter).toBe(true);
    expect(mapped?.navOrder).toBe(20);
    expect(mapped?.structuredBlocks).toEqual([
      { slug: "about-hero", variant: "hero", order: 1 },
      { slug: "about-story", order: 1 },
    ]);
  });

  it("derives navigation and footer groups from page flags", () => {
    const pages: SitePage[] = [
      page({ key: "privacy", href: "/privacy", label: "Privacy", nav: false, footer: true, group: "Legal", order: 20 }),
      page({ key: "blog", href: "/blog", label: "Blog", nav: true, footer: true, group: "Content", order: 30 }),
      page({ key: "about", href: "/about", label: "About", nav: true, footer: true, group: "Site", order: 10 }),
    ];

    expect(deriveSiteNavigation(pages).map((item) => item.label)).toEqual([
      "About",
      "Blog",
    ]);
    expect(deriveSiteFooterGroups(pages).map((group) => group.label)).toEqual([
      "Legal",
      "Content",
      "Site",
    ]);
  });
});

function page(input: {
  key: string;
  href: string;
  label: string;
  nav: boolean;
  footer: boolean;
  group: string;
  order: number;
}): SitePage {
  return {
    pageId: input.key,
    key: input.key,
    slug: input.href.replace(/^\//, ""),
    href: input.href,
    title: input.label,
    description: "",
    seoTitle: input.label,
    seoDescription: "",
    layout: "default",
    published: true,
    showHeader: true,
    showFooter: true,
    showInNav: input.nav,
    navLabel: input.label,
    navOrder: input.order,
    showInFooter: input.footer,
    footerLabel: input.label,
    footerGroup: input.group,
    footerOrder: input.order,
    contentSource: "",
    coverImage: null,
    editUrl: null,
    structuredBlocks: [],
    blocks: [],
  };
}

describe("createSitePagesApi locale-aware listing", () => {
  it("returns fallback pages when no translation source is configured", async () => {
    const model = {
      source: {
        tokenEnv: "NOTION_TOKEN",
        dataSourceEnv: "NOTION_PAGES_DATA_SOURCE_ID",
        fields: {
          title: "Name",
          key: "Key",
          slug: "Slug",
          published: "Status",
        },
      },
    } as unknown as Parameters<typeof createSitePagesApi>[0]["model"];

    const api = createSitePagesApi({
      model,
      fallbackPages: [
        {
          pageId: "home",
          key: "home",
          slug: "",
          href: "/",
          title: "Home",
          description: "",
          seoTitle: "Home",
          seoDescription: "",
          layout: "home" as const,
          published: true,
          showHeader: true,
          showFooter: true,
          showInNav: false,
          navLabel: "",
          navOrder: 0,
          showInFooter: false,
          footerLabel: "",
          footerGroup: "",
          footerOrder: 0,
          contentSource: "",
          coverImage: null,
          editUrl: null,
          structuredBlocks: [],
          blocks: [],
        },
      ],
    });

    const pages = await api.listSitePages("zh-CN");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("Home");

    const page = await api.getSitePageByKey("home", "zh-CN");
    expect(page?.title).toBe("Home");

    const nav = await api.getSiteNavigation("zh-CN");
    expect(nav).toEqual([]);

    const footer = await api.getSiteFooterGroups("zh-CN");
    expect(footer).toEqual([]);
  });
});
