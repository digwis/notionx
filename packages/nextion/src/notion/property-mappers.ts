type PropertyMap = Record<string, unknown>;

type TextPart = {
  plain_text?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
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

function firstPropertyOfType(properties: PropertyMap, type: string) {
  return Object.values(properties).find(
    (property): property is Record<string, unknown> =>
      isRecord(property) && property.type === type
  );
}

export function getFirstTitleProperty(properties: PropertyMap): string {
  const property = firstPropertyOfType(properties, "title");
  return property ? getPlainText(property.title) : "";
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

export function getFirstDateProperty(properties: PropertyMap): string {
  const property = firstPropertyOfType(properties, "date");
  if (!property) return "";
  const date = property.date as { start?: string } | null | undefined;
  return String(date?.start ?? "").trim();
}

export function getSelectProperty(properties: PropertyMap, key: string): string {
  const property = getProperty(properties, key);
  if (property?.type !== "select") return "";
  const select = property.select as { name?: string } | null | undefined;
  return String(select?.name ?? "").trim();
}

export function getCheckboxProperty(properties: PropertyMap, key: string): boolean {
  const property = getProperty(properties, key);
  if (property?.type !== "checkbox") return false;
  return Boolean(property.checkbox);
}

export function getNumberProperty(
  properties: PropertyMap,
  key: string,
  fallback = 0
): number {
  const property = getProperty(properties, key);
  if (property?.type !== "number") return fallback;
  const value = Number(property.number);
  return Number.isFinite(value) ? value : fallback;
}

export function getRelationPageIds(properties: PropertyMap, key: string): string[] {
  const property = getProperty(properties, key);
  if (property?.type !== "relation" || !Array.isArray(property.relation)) {
    return [];
  }

  return property.relation
    .map((item: { id?: string }) => String(item.id ?? "").trim())
    .filter(Boolean);
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

export function getFirstTagsProperty(properties: PropertyMap): string[] {
  const multiSelect = firstPropertyOfType(properties, "multi_select");
  if (multiSelect && Array.isArray(multiSelect.multi_select)) {
    return multiSelect.multi_select
      .map((item: { name?: string }) => String(item.name ?? "").trim())
      .filter(Boolean);
  }

  const select = firstPropertyOfType(properties, "select");
  const name = String((select?.select as { name?: string } | null)?.name ?? "").trim();
  return name ? [name] : [];
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

export function getFirstPeopleProperty(properties: PropertyMap): string {
  const property = firstPropertyOfType(properties, "people");
  if (!property || !Array.isArray(property.people)) return "";

  return property.people
    .map((person: { name?: string; person?: { email?: string } }) =>
      String(person.name ?? person.person?.email ?? "").trim()
    )
    .filter(Boolean)
    .join(", ");
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

/**
 * Normalize a Notion page id (with or without dashes) to a compact lowercase
 * string. Used as a stable identifier in URLs and cache keys.
 */
export function compactNotionId(id: string): string {
  return id.replaceAll("-", "").toLowerCase();
}
