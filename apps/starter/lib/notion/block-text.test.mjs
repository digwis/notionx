import test from "node:test";
import assert from "node:assert/strict";
import { flattenNotionBlockText } from "./block-text.ts";

test("flattenNotionBlockText extracts text from nested Notion blocks", () => {
  const blocks = [
    {
      id: "heading",
      type: "heading_2",
      heading_2: { rich_text: [{ plain_text: "缓存架构" }] },
    },
    {
      id: "toggle",
      type: "toggle",
      has_children: true,
      toggle: { rich_text: [{ plain_text: "展开阅读" }] },
      children: [
        {
          id: "paragraph",
          type: "paragraph",
          paragraph: {
            rich_text: [
              { plain_text: "正文里的 Workers KV 和 D1 搜索索引。" },
            ],
          },
        },
      ],
    },
    {
      id: "table",
      type: "table",
      children: [
        {
          id: "row",
          type: "table_row",
          table_row: {
            cells: [
              [{ plain_text: "Notion" }],
              [{ plain_text: "Cloudflare" }],
            ],
          },
        },
      ],
    },
  ];

  assert.equal(
    flattenNotionBlockText(blocks),
    "缓存架构 展开阅读 正文里的 Workers KV 和 D1 搜索索引。 Notion Cloudflare"
  );
});
