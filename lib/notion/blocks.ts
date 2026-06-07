import type { NotionBlock } from "./types.ts";

type BlockChildrenListResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type NotionBlockClient = {
  blocks: {
    children: {
      list: (args: {
        block_id: string;
        page_size?: number;
        start_cursor?: string;
      }) => Promise<BlockChildrenListResponse>;
    };
  };
};

function normalizeBlock(input: unknown): NotionBlock | null {
  if (!input || typeof input !== "object") return null;
  const block = input as NotionBlock;
  return block.id && block.type ? block : null;
}

export async function listBlockChildren(
  client: NotionBlockClient,
  blockId: string
): Promise<NotionBlock[]> {
  const results: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    for (const item of response.results ?? []) {
      const block = normalizeBlock(item);
      if (block) results.push(block);
    }

    cursor = response.next_cursor ?? undefined;
    if (!response.has_more) break;
  } while (cursor);

  return results;
}

export async function listBlockChildrenDeep(
  client: NotionBlockClient,
  blockId: string,
  options?: { maxDepth?: number }
): Promise<NotionBlock[]> {
  const maxDepth = options?.maxDepth ?? 6;

  async function visit(id: string, depth: number): Promise<NotionBlock[]> {
    const children = await listBlockChildren(client, id);
    if (depth >= maxDepth) return children;

    return Promise.all(
      children.map(async (block) => {
        if (!block.has_children) return block;
        return {
          ...block,
          children: await visit(block.id, depth + 1),
        };
      })
    );
  }

  return visit(blockId, 0);
}
