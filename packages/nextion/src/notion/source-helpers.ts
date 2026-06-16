import { listBlockChildrenDeep, type NotionBlockClient } from "./blocks";
import { createNotionClient } from "./client";
import { getNotionConfigForModel, hasNotionModelConfig, type NotionConfig } from "./config";
import type { NotionBlock, NotionContentModelLike, NotionPageLike } from "./types";

export type NotionDataSourceQueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type NotionDataSourceQueryInput = {
  startCursor?: string;
};

export type NotionQueryDataSourceFn = (
  input?: NotionDataSourceQueryInput
) => Promise<NotionDataSourceQueryResponse>;

export function normalizeNotionPage(input: unknown): NotionPageLike | null {
  if (!input || typeof input !== "object") return null;
  const page = input as NotionPageLike;
  return page.id ? page : null;
}

export async function queryAllNotionDataSourcePages(
  queryDataSource: NotionQueryDataSourceFn
): Promise<NotionPageLike[]> {
  const pages: NotionPageLike[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryDataSource({ startCursor: cursor });
    for (const item of response.results ?? []) {
      const page = normalizeNotionPage(item);
      if (page) pages.push(page);
    }

    cursor = response.next_cursor ?? undefined;
    if (!response.has_more) break;
  } while (cursor);

  return pages;
}

export type NotionSourceContext = {
  config: NotionConfig;
  client: ReturnType<typeof createNotionClient>;
  editBaseUrl: string | undefined;
  getPageBlocks: (pageId: string) => Promise<NotionBlock[]>;
};

export async function createNotionSourceContext(
  model: NotionContentModelLike
): Promise<NotionSourceContext | null> {
  if (!(await hasNotionModelConfig(model))) return null;
  const config = await getNotionConfigForModel(model);
  const client = createNotionClient(config);
  return {
    config,
    client,
    editBaseUrl: config.editBaseUrl,
    getPageBlocks: (pageId: string) =>
      listBlockChildrenDeep(client as unknown as NotionBlockClient, pageId),
  };
}
