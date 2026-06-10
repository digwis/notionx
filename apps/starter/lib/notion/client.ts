import { Client } from "@notionhq/client";
import type { NotionClientConfig } from "./config.ts";

export function createNotionClient(config: NotionClientConfig) {
  return new Client({
    auth: config.token,
    baseUrl: config.apiBaseUrl,
    notionVersion: "2026-03-11",
  });
}
