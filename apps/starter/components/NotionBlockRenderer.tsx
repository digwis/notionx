import GatedVideo from "@/components/GatedVideo";
import NotionRichText from "@/components/NotionRichText";
import {
  isDirectVideoUrl,
  mediaUrlForBlock,
  videoEmbedUrl,
} from "@/lib/notion/media";
import { buildResponsiveImageAttrs } from "@/lib/public-image";
import type { NotionBlock, NotionRichTextPart } from "@/lib/notion/types";

type TypedBlockValue = {
  rich_text?: NotionRichTextPart[];
  caption?: NotionRichTextPart[];
  language?: string;
  checked?: boolean;
  url?: string;
  access_url?: string;
  gated?: boolean;
  cells?: NotionRichTextPart[][];
};

function typedValue(block: NotionBlock): TypedBlockValue {
  return (block[block.type] ?? {}) as TypedBlockValue;
}

function caption(block: NotionBlock) {
  const value = typedValue(block).caption;
  if (!value || value.length === 0) return null;
  return (
    <figcaption className="mt-2 text-center text-sm text-muted-foreground">
      <NotionRichText value={value} />
    </figcaption>
  );
}

function renderChildren(block: NotionBlock) {
  if (!block.children || block.children.length === 0) return null;
  return <NotionBlockRenderer blocks={block.children} nested />;
}

function renderImage(block: NotionBlock) {
  const src = mediaUrlForBlock(block);
  if (!src) return null;
  const image = buildResponsiveImageAttrs(
    src,
    "(max-width: 768px) 100vw, 768px",
    { variant: "detail" }
  );

  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={image.sizes}
        alt=""
        className="mx-auto max-h-[720px] w-full rounded-lg border object-contain"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      {caption(block)}
    </figure>
  );
}

function renderVideo(block: NotionBlock) {
  const typed = typedValue(block);
  if (typed.gated) {
    return (
      <GatedVideo
        accessUrl={typed.access_url ?? null}
        caption={typed.caption}
      />
    );
  }

  const src = mediaUrlForBlock(block) ?? typed.url;
  if (!src) return null;

  const embed = videoEmbedUrl(src);
  if (embed) {
    return (
      <figure className="my-8">
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={embed}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        {caption(block)}
      </figure>
    );
  }

  if (isDirectVideoUrl(src) || src.startsWith("/api/notion/media/")) {
    return (
      <figure className="my-8">
        <video
          src={src}
          className="w-full rounded-lg border bg-black"
          controls
          controlsList="nodownload"
          preload="metadata"
        />
        {caption(block)}
      </figure>
    );
  }

  return renderEmbedUrl(src);
}

function renderEmbedUrl(url: string) {
  if (!/^https:\/\//i.test(url)) return null;
  return (
    <div className="my-8 aspect-video overflow-hidden rounded-lg border bg-muted">
      <iframe
        src={url}
        className="h-full w-full"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow="fullscreen; encrypted-media; picture-in-picture"
      />
    </div>
  );
}

function renderTable(block: NotionBlock) {
  const rows = block.children ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="my-6 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <tbody>
          {rows.map((row) => {
            const cells = typedValue(row).cells ?? [];
            return (
              <tr key={row.id} className="border-b last:border-b-0">
                {cells.map((cell, index) => (
                  <td key={index} className="border-r px-3 py-2 last:border-r-0">
                    <NotionRichText value={cell} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: NotionBlock) {
  const value = typedValue(block);

  switch (block.type) {
    case "paragraph":
      return (
        <p className="my-5 leading-8 text-foreground/90">
          <NotionRichText value={value.rich_text} />
          {renderChildren(block)}
        </p>
      );
    case "heading_1":
      return (
        <h2 className="mb-4 mt-10 text-3xl font-bold tracking-tight">
          <NotionRichText value={value.rich_text} />
        </h2>
      );
    case "heading_2":
      return (
        <h3 className="mb-3 mt-8 text-2xl font-semibold tracking-tight">
          <NotionRichText value={value.rich_text} />
        </h3>
      );
    case "heading_3":
    case "heading_4":
      return (
        <h4 className="mb-2 mt-6 text-xl font-semibold">
          <NotionRichText value={value.rich_text} />
        </h4>
      );
    case "quote":
      return (
        <blockquote className="my-6 border-l-4 pl-4 text-foreground/80">
          <NotionRichText value={value.rich_text} />
          {renderChildren(block)}
        </blockquote>
      );
    case "callout":
      return (
        <aside className="my-6 rounded-lg border bg-muted/40 p-4 leading-7">
          <NotionRichText value={value.rich_text} />
          {renderChildren(block)}
        </aside>
      );
    case "divider":
      return <hr className="my-8" />;
    case "code":
      return (
        <pre className="my-6 overflow-x-auto rounded-lg border bg-muted p-4 text-sm">
          <code>{(value.rich_text ?? []).map((part) => part.plain_text ?? "").join("")}</code>
        </pre>
      );
    case "to_do":
      return (
        <div className="my-3 flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(value.checked)}
            readOnly
            className="mt-1"
          />
          <div className="leading-7">
            <NotionRichText value={value.rich_text} />
            {renderChildren(block)}
          </div>
        </div>
      );
    case "toggle":
      return (
        <details className="my-4 rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">
            <NotionRichText value={value.rich_text} />
          </summary>
          {renderChildren(block)}
        </details>
      );
    case "image":
      return renderImage(block);
    case "video":
      return renderVideo(block);
    case "embed":
      return value.url ? renderEmbedUrl(value.url) : null;
    case "bookmark":
    case "file":
    case "pdf":
    case "audio": {
      const href = mediaUrlForBlock(block) ?? value.url;
      if (!href) return null;
      return (
        <p className="my-4">
          <a className="underline underline-offset-4" href={href}>
            <NotionRichText value={value.caption} />
            {value.caption?.length ? null : href}
          </a>
        </p>
      );
    }
    case "table":
      return renderTable(block);
    case "column_list":
      return (
        <div className="my-6 grid gap-4 md:grid-cols-2">
          {renderChildren(block)}
        </div>
      );
    case "column":
      return <div className="min-w-0">{renderChildren(block)}</div>;
    default:
      return null;
  }
}

function renderListGroup(
  blocks: NotionBlock[],
  start: number,
  type: "bulleted_list_item" | "numbered_list_item"
) {
  const items: NotionBlock[] = [];
  let index = start;
  while (blocks[index]?.type === type) {
    items.push(blocks[index]);
    index += 1;
  }

  const Tag = type === "bulleted_list_item" ? "ul" : "ol";
  return {
    nextIndex: index,
    node: (
      <Tag
        key={`${type}-${start}`}
        className={`my-5 space-y-2 pl-6 leading-7 ${
          type === "bulleted_list_item" ? "list-disc" : "list-decimal"
        }`}
      >
        {items.map((item) => (
          <li key={item.id}>
            <NotionRichText value={typedValue(item).rich_text} />
            {renderChildren(item)}
          </li>
        ))}
      </Tag>
    ),
  };
}

export default function NotionBlockRenderer({
  blocks,
  nested = false,
}: {
  blocks: NotionBlock[];
  nested?: boolean;
}) {
  const nodes = [];
  for (let index = 0; index < blocks.length; ) {
    const block = blocks[index];
    if (
      block.type === "bulleted_list_item" ||
      block.type === "numbered_list_item"
    ) {
      const group = renderListGroup(blocks, index, block.type);
      nodes.push(group.node);
      index = group.nextIndex;
      continue;
    }

    nodes.push(<div key={block.id}>{renderBlock(block)}</div>);
    index += 1;
  }

  return (
    <div className={nested ? "mt-3" : "notion-block-renderer"}>
      {nodes}
    </div>
  );
}
