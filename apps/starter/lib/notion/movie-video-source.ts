import { createNotionClient } from "./client";
import { getNotionClientConfig } from "./config";
import {
  fileObjectForMediaBlock,
  normalizeNotionFileSource,
} from "./media";
import type { NotionBlock, NotionFileSource } from "./types";

export async function refreshNotionMovieVideoSource(
  blockId: string
): Promise<NotionFileSource | null> {
  const client = createNotionClient(await getNotionClientConfig());
  const block = (await client.blocks.retrieve({
    block_id: blockId,
  })) as NotionBlock;

  if (block.type !== "video") return null;
  return normalizeNotionFileSource(fileObjectForMediaBlock(block));
}
