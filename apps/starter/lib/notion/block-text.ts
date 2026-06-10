import type { NotionBlock, NotionRichTextPart } from "./types.ts";

type RichTextContainer = {
  rich_text?: NotionRichTextPart[];
  caption?: NotionRichTextPart[];
  title?: NotionRichTextPart[];
  cells?: NotionRichTextPart[][];
  expression?: string;
};

function typedValue(block: NotionBlock): RichTextContainer {
  return (block[block.type] ?? {}) as RichTextContainer;
}

function richTextPlainText(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: NotionRichTextPart) =>
      part.type === "equation"
        ? part.equation?.expression ?? ""
        : part.plain_text ?? part.text?.content ?? ""
    )
    .join("");
}

function blockPlainText(block: NotionBlock) {
  const value = typedValue(block);
  const text = [
    richTextPlainText(value.rich_text),
    richTextPlainText(value.caption),
    richTextPlainText(value.title),
    value.expression ?? "",
    ...(value.cells ?? []).map(richTextPlainText),
  ];

  return text.filter(Boolean).join(" ");
}

export function flattenNotionBlockText(blocks: readonly NotionBlock[]): string {
  const parts: string[] = [];

  function visit(block: NotionBlock) {
    const text = blockPlainText(block).trim();
    if (text) parts.push(text);
    for (const child of block.children ?? []) {
      visit(child);
    }
  }

  for (const block of blocks) visit(block);

  return parts
    .join(" ")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
