import { cache } from "react";
import { listBlockChildrenDeep, type NotionBlockClient } from "./blocks.ts";
import {
  isRenderablePublishedPost,
  mapNotionPageToListItem,
} from "./mappers.ts";
import type {
  NotionPageLike,
  NotionPostDetail,
  NotionPostListItem,
} from "./types.ts";

type DataSourceQueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type QueryDataSourceInput = {
  startCursor?: string;
};

export type NotionPostSourceDeps = {
  queryDataSource: (
    input?: QueryDataSourceInput
  ) => Promise<DataSourceQueryResponse>;
  getPageBlocks: (pageId: string) => Promise<NotionPostDetail["blocks"]>;
  editBaseUrl?: string;
};

function normalizePage(input: unknown): NotionPageLike | null {
  if (!input || typeof input !== "object") return null;
  const page = input as NotionPageLike;
  return page.id ? page : null;
}

export function createNotionPostSource(deps: NotionPostSourceDeps) {
  return {
    async listPublishedPosts(): Promise<NotionPostListItem[]> {
      const pages: NotionPageLike[] = [];
      let cursor: string | undefined;

      do {
        const response = await deps.queryDataSource({ startCursor: cursor });
        for (const item of response.results ?? []) {
          const page = normalizePage(item);
          if (page) pages.push(page);
        }

        cursor = response.next_cursor ?? undefined;
        if (!response.has_more) break;
      } while (cursor);

      return pages
        .map((page) =>
          mapNotionPageToListItem(page, { editBaseUrl: deps.editBaseUrl })
        )
        .filter(isRenderablePublishedPost)
        .sort((a, b) => b.date.localeCompare(a.date));
    },

    async getPublishedPostBySlug(slug: string): Promise<NotionPostDetail | null> {
      const posts = await this.listPublishedPosts();
      const post = posts.find((item) => item.slug === slug);
      if (!post) return null;

      return {
        ...post,
        blocks: await deps.getPageBlocks(post.pageId),
      };
    },
  };
}

async function createDefaultSource() {
  const [{ createNotionClient }, { getNotionConfig, hasNotionConfig }] =
    await Promise.all([import("./client.ts"), import("./config.ts")]);
  if (!(await hasNotionConfig())) return null;

  const config = await getNotionConfig();
  const client = createNotionClient(config);

  return createNotionPostSource({
    editBaseUrl: config.editBaseUrl,
    queryDataSource: async ({ startCursor } = {}) =>
      client.dataSources.query({
        data_source_id: config.dataSourceId,
        page_size: 100,
        sorts: [{ property: "Date", direction: "descending" }],
        filter_properties: [
          "Title",
          "Slug",
          "Description",
          "Date",
          "Author",
          "Tags",
          "Status",
          "Published",
          "Cover",
        ],
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    getPageBlocks: (pageId) =>
      listBlockChildrenDeep(client as NotionBlockClient, pageId),
  });
}

const getDefaultSource = cache(createDefaultSource);

export const getNotionPostsMeta = cache(async () => {
  const source = await getDefaultSource();
  if (!source) return [];
  return source.listPublishedPosts();
});

export const getNotionPostSlugs = cache(async () => {
  const source = await getDefaultSource();
  if (!source) return [];
  const posts = await source.listPublishedPosts();
  return posts.map((post) => post.slug);
});

export const getNotionPostBySlug = cache(async (slug: string) => {
  const source = await getDefaultSource();
  if (!source) return null;
  return source.getPublishedPostBySlug(slug);
});
