import type { ReactNode } from "react";
import type { NotionRichTextPart } from "@/lib/notion/types";

function safeHref(href: string | null | undefined) {
  const value = String(href ?? "").trim();
  if (!value) return null;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return null;
}

function annotationClassName(part: NotionRichTextPart) {
  const annotations = part.annotations ?? {};
  return [
    annotations.bold ? "font-semibold" : "",
    annotations.italic ? "italic" : "",
    annotations.strikethrough ? "line-through" : "",
    annotations.underline ? "underline underline-offset-2" : "",
    annotations.code
      ? "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderPart(part: NotionRichTextPart, index: number): ReactNode {
  const text =
    part.type === "equation"
      ? part.equation?.expression ?? ""
      : part.plain_text ?? part.text?.content ?? "";
  if (!text) return null;

  const href = safeHref(part.href ?? part.text?.link?.url);
  const className = annotationClassName(part);
  const content = className ? (
    <span className={className}>{text}</span>
  ) : (
    text
  );

  if (href) {
    return (
      <a
        key={index}
        href={href}
        className="underline underline-offset-4 hover:text-foreground"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }

  return <span key={index}>{content}</span>;
}

export default function NotionRichText({
  value,
}: {
  value?: NotionRichTextPart[];
}) {
  const parts = value ?? [];
  return <>{parts.map(renderPart)}</>;
}
