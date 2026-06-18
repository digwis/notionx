import type { NotionBlock, NotionRichTextPart } from "@notionx/core/notion";
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichTextContainer = {
  rich_text?: NotionRichTextPart[];
  caption?: NotionRichTextPart[];
  title?: NotionRichTextPart[];
  cells?: NotionRichTextPart[][];
  expression?: string;
  checked?: boolean;
  color?: string;
  language?: string;
  url?: string;
  icon?: { emoji?: string };
  has_column_header?: boolean;
  has_row_header?: boolean;
};

type FileSource =
  | { type: "external"; url: string }
  | { type: "file"; url: string }
  | { url?: string };

type CustomAction = { label?: string; href?: string };
type CustomConfig = {
  component?: string;
  variant?: string;
  eyebrow?: string;
  title?: string;
  heading?: string;
  description?: string;
  body?: string;
  href?: string;
  label?: string;
  primaryAction?: CustomAction;
  secondaryAction?: CustomAction;
  items?: Array<{ title?: string; description?: string; href?: string }>;
  plans?: Array<{ title?: string; price?: string; description?: string; features?: string[]; href?: string }>;
  questions?: Array<{ question?: string; answer?: string }>;
  testimonials?: Array<{ quote?: string; author?: string; role?: string }>;
};

type BlockGroup =
  | { kind: "block"; block: NotionBlock }
  | { kind: "list"; ordered: boolean; blocks: NotionBlock[] };

function typedValue<T extends Record<string, unknown> = RichTextContainer>(
  block: NotionBlock
): T {
  return ((block[block.type] ?? {}) as T) || ({} as T);
}

function partText(part: NotionRichTextPart): string {
  if (part.type === "equation") return part.equation?.expression ?? "";
  return part.plain_text ?? part.text?.content ?? "";
}

function plainText(parts: NotionRichTextPart[] | undefined): string {
  return parts?.map(partText).join("") ?? "";
}

function notionColorClass(color: string | undefined): string | undefined {
  switch (color) {
    case "gray":
      return "text-muted-foreground";
    case "brown":
      return "text-amber-900 dark:text-amber-200";
    case "orange":
      return "text-orange-700 dark:text-orange-300";
    case "yellow":
      return "text-yellow-700 dark:text-yellow-300";
    case "green":
      return "text-emerald-700 dark:text-emerald-300";
    case "blue":
      return "text-blue-700 dark:text-blue-300";
    case "purple":
      return "text-violet-700 dark:text-violet-300";
    case "pink":
      return "text-pink-700 dark:text-pink-300";
    case "red":
      return "text-red-700 dark:text-red-300";
    case "gray_background":
      return "bg-muted text-foreground";
    case "brown_background":
      return "bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100";
    case "orange_background":
      return "bg-orange-50 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100";
    case "yellow_background":
      return "bg-yellow-50 text-yellow-950 dark:bg-yellow-950/30 dark:text-yellow-100";
    case "green_background":
      return "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100";
    case "blue_background":
      return "bg-blue-50 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100";
    case "purple_background":
      return "bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100";
    case "pink_background":
      return "bg-pink-50 text-pink-950 dark:bg-pink-950/30 dark:text-pink-100";
    case "red_background":
      return "bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100";
    default:
      return undefined;
  }
}

function renderRichText(parts: NotionRichTextPart[] | undefined): ReactNode {
  if (!parts || parts.length === 0) return null;
  return parts.map((part, idx) => {
    const text = partText(part);
    if (!text) return null;
    let node: ReactNode = text;
    if (part.annotations?.code) {
      node = (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {node}
        </code>
      );
    }
    if (part.annotations?.bold) node = <strong>{node}</strong>;
    if (part.annotations?.italic) node = <em>{node}</em>;
    if (part.annotations?.strikethrough) node = <s>{node}</s>;
    if (part.annotations?.underline) node = <u>{node}</u>;
    const colorClass = notionColorClass(part.annotations?.color);
    if (colorClass) node = <span className={colorClass}>{node}</span>;
    if (part.href) {
      node = (
        <a
          href={part.href}
          target={part.href.startsWith("/") ? undefined : "_blank"}
          rel={part.href.startsWith("/") ? undefined : "noreferrer noopener"}
          className="text-primary underline underline-offset-4"
        >
          {node}
        </a>
      );
    }
    return <Fragment key={idx}>{node}</Fragment>;
  });
}

function readFileUrl(source: unknown): string | null {
  if (!source || typeof source !== "object") return null;
  const typed = source as FileSource;
  return typeof typed.url === "string" && typed.url.length > 0
    ? typed.url
    : null;
}

function readBlockFileUrl(value: Record<string, unknown>): string | null {
  return readFileUrl(value.file ?? value.external);
}

function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith("/")) return href;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

function groupBlocks(blocks: NotionBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let pending: { ordered: boolean; blocks: NotionBlock[] } | null = null;

  for (const block of blocks) {
    const ordered = block.type === "numbered_list_item";
    const isList = ordered || block.type === "bulleted_list_item";
    if (!isList) {
      if (pending) groups.push({ kind: "list", ...pending });
      pending = null;
      groups.push({ kind: "block", block });
      continue;
    }
    if (!pending || pending.ordered !== ordered) {
      if (pending) groups.push({ kind: "list", ...pending });
      pending = { ordered, blocks: [block] };
    } else {
      pending.blocks.push(block);
    }
  }

  if (pending) groups.push({ kind: "list", ...pending });
  return groups;
}

function renderListGroup(group: Extract<BlockGroup, { kind: "list" }>) {
  const Tag = group.ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "my-4 space-y-2 pl-6",
        group.ordered ? "list-decimal" : "list-disc"
      )}
    >
      {group.blocks.map((block) => {
        const value = typedValue(block);
        return (
          <li key={block.id} className="leading-7 text-foreground/90">
            {renderRichText(value.rich_text)}
            {block.children?.length ? (
              <div className="mt-2">
                <NotionBlocks blocks={block.children} />
              </div>
            ) : null}
          </li>
        );
      })}
    </Tag>
  );
}

function renderCustomComponent(config: CustomConfig, key: string): ReactNode {
  const title = config.title ?? config.heading;
  const description = config.description ?? config.body;
  const primaryHref = safeHref(config.primaryAction?.href ?? config.href);
  const primaryLabel = config.primaryAction?.label ?? config.label;
  const secondaryHref = safeHref(config.secondaryAction?.href);

  switch (config.component) {
    case "hero":
      return (
        <section key={key} className="my-12 grid gap-8 py-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-5">
            {config.eyebrow ? (
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {config.eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                {description}
              </p>
            ) : null}
            {primaryHref && primaryLabel ? (
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={primaryHref}>{primaryLabel}</a>
                </Button>
                {secondaryHref && config.secondaryAction?.label ? (
                  <Button asChild variant="outline" size="lg">
                    <a href={secondaryHref}>{config.secondaryAction.label}</a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-h-64 rounded-lg border bg-muted" />
        </section>
      );
    case "cta":
      return (
        <section key={key} className="my-10 rounded-lg border bg-muted/40 p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
              {description ? <p className="text-muted-foreground">{description}</p> : null}
            </div>
            {primaryHref && primaryLabel ? (
              <Button asChild>
                <a href={primaryHref}>{primaryLabel}</a>
              </Button>
            ) : null}
          </div>
        </section>
      );
    case "feature-grid":
      return (
        <section key={key} className="my-10 space-y-6">
          {title ? <h2 className="text-3xl font-semibold tracking-tight">{title}</h2> : null}
          <div className="grid gap-4 md:grid-cols-3">
            {(config.items ?? []).map((item, index) => (
              <div key={index} className="rounded-lg border bg-card p-5 text-card-foreground">
                {item.title ? <h3 className="font-semibold">{item.title}</h3> : null}
                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      );
    case "pricing":
      return (
        <section key={key} className="my-10 space-y-6">
          {title ? <h2 className="text-3xl font-semibold tracking-tight">{title}</h2> : null}
          <div className="grid gap-4 md:grid-cols-3">
            {(config.plans ?? []).map((plan, index) => {
              const href = safeHref(plan.href);
              return (
                <div key={index} className="rounded-lg border bg-card p-6 text-card-foreground">
                  {plan.title ? <h3 className="text-lg font-semibold">{plan.title}</h3> : null}
                  {plan.price ? <p className="mt-4 text-3xl font-bold">{plan.price}</p> : null}
                  {plan.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  ) : null}
                  {plan.features?.length ? (
                    <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                      {plan.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  ) : null}
                  {href ? (
                    <Button asChild className="mt-6 w-full">
                      <a href={href}>{plan.title ?? "Select"}</a>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      );
    case "faq":
      return (
        <section key={key} className="my-10 space-y-4">
          {title ? <h2 className="text-3xl font-semibold tracking-tight">{title}</h2> : null}
          <div className="divide-y rounded-lg border">
            {(config.questions ?? []).map((item, index) => (
              <details key={index} className="group p-4">
                <summary className="cursor-pointer font-medium">{item.question}</summary>
                {item.answer ? (
                  <p className="mt-3 leading-7 text-muted-foreground">{item.answer}</p>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      );
    case "testimonial-grid":
      return (
        <section key={key} className="my-10 grid gap-4 md:grid-cols-3">
          {(config.testimonials ?? []).map((item, index) => (
            <figure key={index} className="rounded-lg border bg-card p-5 text-card-foreground">
              {item.quote ? <blockquote className="leading-7">{item.quote}</blockquote> : null}
              {(item.author || item.role) ? (
                <figcaption className="mt-4 text-sm text-muted-foreground">
                  {[item.author, item.role].filter(Boolean).join(" - ")}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </section>
      );
    case "content-list":
      return (
        <section key={key} className="my-10 rounded-lg border p-6">
          {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
          {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
        </section>
      );
    case "contact-form":
      return (
        <section key={key} className="my-10 rounded-lg border bg-card p-6 text-card-foreground">
          {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
          {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
          {primaryHref && primaryLabel ? (
            <Button asChild className="mt-5">
              <a href={primaryHref}>{primaryLabel}</a>
            </Button>
          ) : null}
        </section>
      );
    default:
      return renderDevFallback(key, `Unsupported vinext component: ${config.component ?? "unknown"}`);
  }
}

function parseCustomConfig(codeText: string): CustomConfig | null {
  try {
    const parsed = JSON.parse(codeText) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const config = parsed as CustomConfig;
    return typeof config.component === "string" ? config : null;
  } catch {
    return null;
  }
}

function renderTable(block: NotionBlock): ReactNode {
  const value = typedValue(block);
  const rows = (block.children ?? []).filter((child) => child.type === "table_row");
  if (!rows.length) return null;
  const hasColumnHeader = Boolean(value.has_column_header);
  const hasRowHeader = Boolean(value.has_row_header);

  function renderRow(row: NotionBlock, rowIndex: number) {
    const rowValue = typedValue(row);
    const cells = rowValue.cells ?? [];
    const RowTag = hasColumnHeader && rowIndex === 0 ? "tr" : "tr";
    return (
      <RowTag key={row.id} className="border-b last:border-b-0">
        {cells.map((cell, cellIndex) => {
          const isHeader =
            (hasColumnHeader && rowIndex === 0) || (hasRowHeader && cellIndex === 0);
          const CellTag = isHeader ? "th" : "td";
          return (
            <CellTag
              key={cellIndex}
              className={cn(
                "min-w-32 px-4 py-3 align-top text-sm leading-6",
                isHeader ? "bg-muted/40 text-left font-medium" : "text-foreground/90"
              )}
              scope={isHeader ? "col" : undefined}
            >
              {renderRichText(cell)}
            </CellTag>
          );
        })}
      </RowTag>
    );
  }

  return (
    <div key={block.id} className="my-8 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        {hasColumnHeader ? <thead>{renderRow(rows[0], 0)}</thead> : null}
        <tbody>{rows.slice(hasColumnHeader ? 1 : 0).map((row, idx) => renderRow(row, idx + (hasColumnHeader ? 1 : 0)))}</tbody>
      </table>
    </div>
  );
}

function renderColumns(block: NotionBlock): ReactNode {
  const columns = block.children?.filter((child) => child.type === "column") ?? [];
  if (!columns.length) return null;
  const gridClass =
    columns.length >= 3
      ? "md:grid-cols-3"
      : columns.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1";
  return (
    <div key={block.id} className={cn("my-8 grid gap-6", gridClass)}>
      {columns.map((column) => (
        <div key={column.id} className="min-w-0">
          <NotionBlocks blocks={column.children ?? []} />
        </div>
      ))}
    </div>
  );
}

function renderDevFallback(key: string, label: string): ReactNode {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div key={key} className="my-4 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function renderBlock(block: NotionBlock): ReactNode {
  const value = typedValue(block);
  const colorClass = notionColorClass(value.color);

  switch (block.type) {
    case "paragraph": {
      const text = renderRichText(value.rich_text);
      if (!text) return <div key={block.id} className="h-3" />;
      return (
        <p key={block.id} className={cn("my-4 leading-7 text-foreground/90", colorClass)}>
          {text}
        </p>
      );
    }
    case "heading_1":
      return (
        <h2 key={block.id} className={cn("mt-12 mb-4 text-3xl font-semibold tracking-tight", colorClass)}>
          {renderRichText(value.rich_text)}
        </h2>
      );
    case "heading_2":
      return (
        <h2 key={block.id} className={cn("mt-10 mb-4 text-2xl font-semibold tracking-tight", colorClass)}>
          {renderRichText(value.rich_text)}
        </h2>
      );
    case "heading_3":
      return (
        <h3 key={block.id} className={cn("mt-8 mb-3 text-xl font-semibold tracking-tight", colorClass)}>
          {renderRichText(value.rich_text)}
        </h3>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return renderListGroup({
        kind: "list",
        ordered: block.type === "numbered_list_item",
        blocks: [block],
      });
    case "to_do":
      return (
        <div key={block.id} className="my-3 flex items-start gap-3 leading-7 text-foreground/90">
          <span
            aria-hidden="true"
            className={cn(
              "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
              value.checked && "border-primary bg-primary text-primary-foreground"
            )}
          >
            {value.checked ? "✓" : null}
          </span>
          <div>
            {renderRichText(value.rich_text)}
            {block.children?.length ? <NotionBlocks blocks={block.children} /> : null}
          </div>
        </div>
      );
    case "quote":
      return (
        <blockquote key={block.id} className={cn("my-6 border-l-4 border-muted-foreground/30 pl-4 italic leading-7 text-muted-foreground", colorClass)}>
          {renderRichText(value.rich_text)}
        </blockquote>
      );
    case "callout":
      return (
        <div key={block.id} className={cn("my-6 flex gap-3 rounded-lg border bg-muted/40 p-4", colorClass)}>
          {value.icon?.emoji ? <div className="text-xl leading-none">{value.icon.emoji}</div> : null}
          <div className="min-w-0 flex-1 leading-7">
            {renderRichText(value.rich_text)}
            {block.children?.length ? <NotionBlocks blocks={block.children} /> : null}
          </div>
        </div>
      );
    case "divider":
      return <hr key={block.id} className="my-8 border-muted-foreground/20" />;
    case "code": {
      const codeText = plainText(value.rich_text);
      const language = value.language ?? "text";
      if (language === "vinext") {
        const config = parseCustomConfig(codeText);
        if (config) return renderCustomComponent(config, block.id);
      }
      return (
        <pre key={block.id} className="my-6 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
          <code data-language={language} className="font-mono">
            {codeText}
          </code>
        </pre>
      );
    }
    case "image": {
      const url = readBlockFileUrl(value);
      const caption = plainText(value.caption);
      if (!url) return null;
      return (
        <figure key={block.id} className="my-8 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption || ""} className="w-full rounded-lg border bg-muted" loading="lazy" />
          {caption ? <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption> : null}
        </figure>
      );
    }
    case "video": {
      const url = readBlockFileUrl(value);
      if (!url) return null;
      return (
        <div key={block.id} className="my-8 overflow-hidden rounded-lg border bg-muted">
          <video controls src={url} className="aspect-video w-full" />
        </div>
      );
    }
    case "audio": {
      const url = readBlockFileUrl(value);
      if (!url) return null;
      return <audio key={block.id} controls src={url} className="my-6 w-full" />;
    }
    case "pdf":
    case "file": {
      const url = readBlockFileUrl(value);
      const caption = plainText(value.caption) || url;
      if (!url) return null;
      return (
        <a key={block.id} href={url} target="_blank" rel="noreferrer noopener" className="my-4 block rounded-md border bg-muted/40 px-4 py-3 text-sm hover:bg-muted">
          {caption}
        </a>
      );
    }
    case "embed":
    case "bookmark":
    case "link_preview": {
      const url = safeHref(value.url);
      if (!url) return null;
      return (
        <a key={block.id} href={url} target={url.startsWith("/") ? undefined : "_blank"} rel={url.startsWith("/") ? undefined : "noreferrer noopener"} className="my-4 block rounded-lg border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-muted/60">
          <span className="block truncate text-sm font-medium">{url}</span>
        </a>
      );
    }
    case "toggle":
      return (
        <details key={block.id} className="my-4 rounded-lg border bg-muted/30 px-4 py-3">
          <summary className="cursor-pointer font-medium leading-7">
            {renderRichText(value.rich_text)}
          </summary>
          {block.children?.length ? <div className="mt-3"><NotionBlocks blocks={block.children} /></div> : null}
        </details>
      );
    case "table":
      return renderTable(block);
    case "column_list":
      return renderColumns(block);
    case "column":
      return <NotionBlocks key={block.id} blocks={block.children ?? []} />;
    case "child_page": {
      const title = plainText(value.title) || (value as { title?: string }).title || "Untitled";
      return (
        <div key={block.id} className="my-4 rounded-lg border bg-card px-4 py-3 text-card-foreground">
          <span className="font-medium">{title}</span>
        </div>
      );
    }
    case "button": {
      const label = plainText(value.rich_text ?? value.title) || (value as { name?: string }).name;
      const href = safeHref(value.url ?? (value as { href?: string }).href);
      if (!label || !href) return renderDevFallback(block.id, "Unsupported Notion button action");
      return (
        <div key={block.id} className="my-5">
          <Button asChild>
            <a href={href}>{label}</a>
          </Button>
        </div>
      );
    }
    case "equation":
      return (
        <div key={block.id} className="my-4 overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-sm">
          {value.expression}
        </div>
      );
    case "synced_block":
      return block.children?.length ? <NotionBlocks key={block.id} blocks={block.children} /> : null;
    case "child_database":
      return renderDevFallback(block.id, "child_database needs an explicit content-list mapping");
    case "table_row":
      return null;
    default:
      return renderDevFallback(block.id, `Unsupported Notion block: ${block.type}`);
  }
}

export function NotionBlocks({ blocks }: { blocks: NotionBlock[] }) {
  if (!blocks || blocks.length === 0) return null;
  const groups = groupBlocks(blocks);
  return (
    <div className="max-w-none">
      {groups.map((group) =>
        group.kind === "list" ? renderListGroup(group) : renderBlock(group.block)
      )}
    </div>
  );
}

