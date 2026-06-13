import type { NotionBlock, NotionFileSource, NotionPageLike } from "./types";

type FileLike = {
  type?: string;
  external?: { url?: string };
  file?: { url?: string; expiry_time?: string };
  name?: string;
};

function stripLeadingSlash(value: string) {
  return value.startsWith("/") ? value.slice(1) : value;
}

function encodePathPart(value: string) {
  return encodeURIComponent(stripLeadingSlash(value));
}

function appendVersion(path: string, version?: string) {
  const value = String(version ?? "").trim();
  if (!value) return path;
  return `${path}?${new URLSearchParams({ v: value })}`;
}

function blockVersion(block: NotionBlock): string | undefined {
  return typeof block.last_edited_time === "string"
    ? block.last_edited_time
    : undefined;
}

export function notionPageCoverMediaPath(pageId: string): string {
  return `/api/notion/media/page/${encodePathPart(pageId)}/cover`;
}

export function notionPagePropertyMediaPath(
  pageId: string,
  propertyName: string
): string {
  return `/api/notion/media/page/${encodePathPart(pageId)}/property/${encodePathPart(propertyName)}`;
}

export function notionBlockMediaPath(blockId: string): string {
  return `/api/notion/media/block/${encodePathPart(blockId)}`;
}

export function normalizeNotionFileSource(input: unknown): NotionFileSource | null {
  const file = input as FileLike | null | undefined;
  if (!file || typeof file !== "object") return null;

  if (file.type === "external") {
    const url = String(file.external?.url ?? "").trim();
    return url ? { type: "external", url } : null;
  }

  if (file.type === "file") {
    const url = String(file.file?.url ?? "").trim();
    if (!url) return null;
    return {
      type: "file",
      url,
      expiryTime: String(file.file?.expiry_time ?? "").trim() || null,
    };
  }

  return null;
}

export function resolveNotionFileUrl(input: unknown): string | null {
  return normalizeNotionFileSource(input)?.url ?? null;
}

export function isNotionHostedFile(input: unknown): boolean {
  return normalizeNotionFileSource(input)?.type === "file";
}

export function pickFirstFilesPropertyValue(property: unknown): unknown | null {
  const value = property as { type?: string; files?: unknown[] } | null | undefined;
  if (!value || value.type !== "files" || !Array.isArray(value.files)) {
    return null;
  }
  return value.files[0] ?? null;
}

export function pickPageCoverFile(page: NotionPageLike): unknown | null {
  return page.cover ?? null;
}

export function coverImageUrlForPage(
  page: NotionPageLike,
  coverPropertyName = "Cover"
): string | null {
  const propertyFile = pickFirstFilesPropertyValue(
    page.properties?.[coverPropertyName]
  );
  const propertySource = normalizeNotionFileSource(propertyFile);
  if (propertySource) {
    return appendVersion(
      notionPagePropertyMediaPath(page.id, coverPropertyName),
      page.last_edited_time
    );
  }

  const coverSource = normalizeNotionFileSource(pickPageCoverFile(page));
  if (coverSource) {
    return appendVersion(notionPageCoverMediaPath(page.id), page.last_edited_time);
  }

  return null;
}

export function fileObjectForMediaBlock(block: NotionBlock): unknown | null {
  const typed = block[block.type] as Record<string, unknown> | undefined;
  if (!typed || typeof typed !== "object") return null;

  if (
    block.type === "image" ||
    block.type === "video" ||
    block.type === "file" ||
    block.type === "pdf" ||
    block.type === "audio"
  ) {
    return typed;
  }

  return null;
}

export function mediaUrlForBlock(block: NotionBlock): string | null {
  const source = normalizeNotionFileSource(fileObjectForMediaBlock(block));
  if (!source) return null;
  if (source.type === "external" && block.type !== "image") {
    return source.url;
  }
  return appendVersion(notionBlockMediaPath(block.id), blockVersion(block));
}

export function firstImageUrlFromBlocks(blocks: NotionBlock[]): string | null {
  for (const block of blocks) {
    if (block.type === "image") {
      const imageUrl = mediaUrlForBlock(block);
      if (imageUrl) return imageUrl;
    }

    const nested = block.children?.length
      ? firstImageUrlFromBlocks(block.children)
      : null;
    if (nested) return nested;
  }

  return null;
}

export function publicMediaBlockForApi(block: NotionBlock): NotionBlock {
  const value = block[block.type];
  const source = normalizeNotionFileSource(value);
  const children = block.children?.map(publicMediaBlockForApi);

  if (!source) {
    return children ? { ...block, children } : { ...block };
  }

  const path = appendVersion(notionBlockMediaPath(block.id), blockVersion(block));
  const publicValue =
    source.type === "external"
      ? block.type === "image"
        ? {
            ...(value as Record<string, unknown>),
            external: { url: path },
          }
        : value
      : {
          ...(value as Record<string, unknown>),
          file: {
            url: path,
            expiry_time: null,
          },
        };

  return {
    ...block,
    [block.type]: publicValue,
    ...(children ? { children } : {}),
  };
}

export function gatedMediaBlockForApi(
  block: NotionBlock,
  options?: { accessUrlForBlock?: (block: NotionBlock) => string | null }
): NotionBlock {
  const value = block[block.type];
  const source = normalizeNotionFileSource(value);
  const children = block.children?.map((child) =>
    gatedMediaBlockForApi(child, options)
  );

  if (block.type !== "video" || !source) {
    const publicBlock = publicMediaBlockForApi(block);
    return children ? { ...publicBlock, children } : publicBlock;
  }

  const gatedValue: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
    gated: true,
    access_url: options?.accessUrlForBlock?.(block) ?? null,
  };

  if (source.type === "external") {
    gatedValue.external = { url: null };
  } else {
    gatedValue.file = {
      url: null,
      expiry_time: null,
    };
  }

  return {
    ...block,
    video: gatedValue,
    ...(children ? { children } : {}),
  };
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function videoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }

    if (host === "youtube-nocookie.com") {
      return parsed.toString();
    }

    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : null;
    }

    if (host === "player.vimeo.com") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}
