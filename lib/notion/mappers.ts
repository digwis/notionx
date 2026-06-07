import { coverImageUrlForPage } from "./media.ts";
import type { NotionPageLike, NotionPostListItem } from "./types.ts";

type PropertyMap = Record<string, unknown>;

type TextPart = {
  plain_text?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function getPlainText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: TextPart) => part.plain_text ?? "")
    .join("")
    .trim();
}

function getProperty(properties: PropertyMap, key: string) {
  return properties[key] as Record<string, unknown> | undefined;
}

export function getRichTextProperty(properties: PropertyMap, key: string): string {
  const property = getProperty(properties, key);
  if (!property) return "";

  if (property.type === "title") return getPlainText(property.title);
  if (property.type === "rich_text") return getPlainText(property.rich_text);
  if (property.type === "url") return String(property.url ?? "").trim();
  if (property.type === "email") return String(property.email ?? "").trim();
  if (property.type === "phone_number") {
    return String(property.phone_number ?? "").trim();
  }

  return "";
}

export function getDateProperty(properties: PropertyMap, key: string): string {
  const property = getProperty(properties, key);
  if (property?.type !== "date") return "";
  const date = property.date as { start?: string } | null | undefined;
  return String(date?.start ?? "").trim();
}

export function getTagsProperty(properties: PropertyMap, key: string): string[] {
  const property = getProperty(properties, key);
  if (property?.type === "multi_select" && Array.isArray(property.multi_select)) {
    return property.multi_select
      .map((item: { name?: string }) => String(item.name ?? "").trim())
      .filter(Boolean);
  }

  if (property?.type === "select") {
    const select = property.select as { name?: string } | null | undefined;
    const name = String(select?.name ?? "").trim();
    return name ? [name] : [];
  }

  return [];
}

export function getAuthorProperty(properties: PropertyMap, key: string): string {
  const property = getProperty(properties, key);
  if (!property) return "";

  if (property.type === "people" && Array.isArray(property.people)) {
    return property.people
      .map((person: { name?: string; person?: { email?: string } }) =>
        String(person.name ?? person.person?.email ?? "").trim()
      )
      .filter(Boolean)
      .join(", ");
  }

  return getRichTextProperty(properties, key);
}

export function pickPublishedFlag(properties: PropertyMap): boolean {
  const published = getProperty(properties, "Published");
  if (published?.type === "checkbox") {
    return Boolean(published.checkbox);
  }

  const status = getProperty(properties, "Status");
  if (status?.type === "status") {
    const statusValue = status.status as { name?: string } | null | undefined;
    return String(statusValue?.name ?? "").trim().toLowerCase() === "published";
  }

  if (status?.type === "select") {
    const statusValue = status.select as { name?: string } | null | undefined;
    return String(statusValue?.name ?? "").trim().toLowerCase() === "published";
  }

  return false;
}

export function pickDescriptionFallback(description: string, title: string): string {
  return description.trim() || title.trim();
}

export function isValidPublicSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug);
}

export function notionPageEditUrl(pageId: string, editBaseUrl?: string): string {
  const compactPageId = pageId.replaceAll("-", "");
  if (editBaseUrl?.includes("{pageId}")) {
    return editBaseUrl.replaceAll("{pageId}", compactPageId);
  }
  return `https://www.notion.so/${compactPageId}`;
}

export function mapNotionPageToListItem(
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): NotionPostListItem {
  const properties = isRecord(page.properties) ? page.properties : {};
  const title = getRichTextProperty(properties, "Title");
  const slug = getRichTextProperty(properties, "Slug").toLowerCase();
  const description = pickDescriptionFallback(
    getRichTextProperty(properties, "Description"),
    title
  );

  return {
    pageId: page.id,
    slug,
    title,
    description,
    date: getDateProperty(properties, "Date"),
    author: getAuthorProperty(properties, "Author") || "Unknown",
    tags: getTagsProperty(properties, "Tags"),
    coverImage: coverImageUrlForPage(page),
    published: pickPublishedFlag(properties),
    editUrl: notionPageEditUrl(page.id, options?.editBaseUrl),
  };
}

export function isRenderablePublishedPost(post: NotionPostListItem): boolean {
  return Boolean(
    post.published &&
      post.title &&
      post.date &&
      post.slug &&
      isValidPublicSlug(post.slug)
  );
}
