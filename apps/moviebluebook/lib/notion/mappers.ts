// Re-exported from @vinext/foundation/notion. Will be removed in Phase 2.
export * from "@vinext/foundation/notion/mappers";

import { coverImageUrlForPage } from "@vinext/foundation/notion/media";
import { blogContentModel } from "../content/models.ts";
import type {
  NotionPageLike,
  NotionPostListItem,
} from "@vinext/foundation/notion/types";
import {
  getAuthorProperty,
  getDateProperty,
  getFirstDateProperty,
  getFirstPeopleProperty,
  getFirstTagsProperty,
  getFirstTitleProperty,
  getRichTextProperty,
  getTagsProperty,
  isRecord,
  isValidPublicSlug,
  notionPageEditUrl,
  pickDescriptionFallback,
  pickPublishedFlag,
} from "@vinext/foundation/notion/property-mappers";

function compactNotionId(id: string) {
  return id.replaceAll("-", "").toLowerCase();
}

function fallbackDateForPage(page: NotionPageLike) {
  const timestamp = page.last_edited_time ?? page.created_time;
  return timestamp ? timestamp.slice(0, 10) : "";
}

function hasPublishControl(properties: Record<string, unknown>) {
  const fields = blogContentModel.source.fields;
  return Boolean(properties[fields.published] || properties[fields.status]);
}

export function mapNotionPageToListItem(
  page: NotionPageLike,
  options?: { editBaseUrl?: string }
): NotionPostListItem {
  const fields = blogContentModel.source.fields;
  const properties = isRecord(page.properties) ? page.properties : {};
  const title =
    getRichTextProperty(properties, fields.title) ||
    getFirstTitleProperty(properties);
  const configuredSlug = getRichTextProperty(properties, fields.slug).toLowerCase();
  const slug = isValidPublicSlug(configuredSlug)
    ? configuredSlug
    : compactNotionId(page.id);
  const description = pickDescriptionFallback(
    getRichTextProperty(properties, fields.description) || getFirstTitleProperty(properties),
    title
  );
  const published = hasPublishControl(properties)
    ? pickPublishedFlag(properties)
    : true;
  const configuredTags = getTagsProperty(properties, fields.tags);

  return {
    pageId: page.id,
    ...(page.last_edited_time ? { updatedAt: page.last_edited_time } : {}),
    slug,
    title,
    description,
    date:
      getDateProperty(properties, fields.date) ||
      getFirstDateProperty(properties) ||
      fallbackDateForPage(page),
    author:
      getAuthorProperty(properties, fields.author) ||
      getFirstPeopleProperty(properties) ||
      "Unknown",
    tags: configuredTags.length ? configuredTags : getFirstTagsProperty(properties),
    coverImage: coverImageUrlForPage(page),
    published,
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
