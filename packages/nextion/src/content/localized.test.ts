import { describe, expect, it } from "vitest";
import {
  getAlternateLocalizedContentLinks,
  localizeContentList,
  mapNotionPageToLocalizedContentTranslation,
} from "./localized";
import type { NotionPageLike } from "../notion/types";

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

describe("localized content helpers", () => {
  it("maps a Notion translation row into a common localized content shape", () => {
    const page: NotionPageLike = {
      id: "translation-page",
      properties: {
        Title: title("Hello"),
        Source: { type: "relation", relation: [{ id: "source-page" }] },
        Locale: { type: "select", select: { name: "en" } },
        Slug: richText("hello"),
        Published: { type: "checkbox", checkbox: true },
        Summary: richText("Short copy"),
        Tags: { type: "multi_select", multi_select: [{ name: "Guide" }] },
      },
    };

    const mapped = mapNotionPageToLocalizedContentTranslation<{
      summary: string;
      tags: string[];
    }>(page, {
      fields: {
        title: "Title",
        source: "Source",
        locale: "Locale",
        slug: "Slug",
        published: "Published",
      },
      extraFields: {
        summary: "Summary",
        tags: { field: "Tags", kind: "tags" },
      },
    });

    expect(mapped).toMatchObject({
      pageId: "translation-page",
      sourcePageId: "source-page",
      locale: "en",
      slug: "hello",
      title: "Hello",
      summary: "Short copy",
      tags: ["Guide"],
      published: true,
      editUrl: "https://www.notion.so/translationpage",
    });
  });

  it("localizes lists and keeps default-locale fallback content", () => {
    type BaseItem = { pageId: string; routeId: string; title: string };
    type Translation = {
      sourcePageId: string;
      locale: string;
      slug: string;
      title?: string;
    };

    const baseItems: BaseItem[] = [
      { pageId: "source-page", routeId: "source", title: "Source" },
    ];
    const translations: Translation[] = [
      {
        sourcePageId: "source-page",
        locale: "zh-CN",
        slug: "yuan-nei-rong",
        title: "源内容",
      },
    ];

    const defaultList = localizeContentList({
      baseItems,
      translations: [] as Translation[],
      locale: "en",
      defaultLocale: "en",
      getBasePageId: (item) => item.pageId,
      getTranslationLocale: (translation) => translation.locale,
      getTranslationSourcePageId: (translation) => translation.sourcePageId,
      applyTranslation: (item, translation) => ({
        slug: translation.slug,
        title: translation.title || item.title,
      }),
      fallback: (item) => ({ slug: item.routeId, title: item.title }),
    });

    const localizedList = localizeContentList({
      baseItems,
      translations,
      locale: "zh-CN",
      defaultLocale: "en",
      getBasePageId: (item) => item.pageId,
      getTranslationLocale: (translation) => translation.locale,
      getTranslationSourcePageId: (translation) => translation.sourcePageId,
      applyTranslation: (item, translation) => ({
        slug: translation.slug,
        title: translation.title || item.title,
      }),
      fallback: (item) => ({ slug: item.routeId, title: item.title }),
    });

    expect(defaultList).toEqual([{ slug: "source", title: "Source" }]);
    expect(localizedList).toEqual([
      { slug: "yuan-nei-rong", title: "源内容" },
    ]);
  });

  it("derives alternate localized links for a source page", () => {
    type TranslationLink = {
      sourcePageId: string;
      locale: string;
      slug: string;
    };

    const links = getAlternateLocalizedContentLinks({
      translations: [
        { sourcePageId: "source-page", locale: "en", slug: "source" },
        { sourcePageId: "source-page", locale: "zh-CN", slug: "yuan" },
        { sourcePageId: "other-page", locale: "ja", slug: "other" },
      ] satisfies TranslationLink[],
      sourcePageId: "source-page",
      currentLocale: "en",
      getTranslationLocale: (translation) => translation.locale,
      getTranslationSlug: (translation) => translation.slug,
      getTranslationSourcePageId: (translation) => translation.sourcePageId,
      hrefForTranslation: (locale, slug) => `/${locale}/docs/${slug}`,
    });

    expect(links).toEqual([
      {
        locale: "zh-CN",
        slug: "yuan",
        href: "/zh-CN/docs/yuan",
        label: "zh-CN",
      },
    ]);
  });
});
