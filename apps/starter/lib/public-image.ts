const DEFAULT_IMAGE_WIDTHS = [320, 640, 960, 1200] as const;
const DEFAULT_IMAGE_QUALITY = 85;
const MIN_IMAGE_QUALITY = 40;

const LIST_IMAGE_WIDTHS = [320, 480, 640] as const;
const LIST_IMAGE_QUALITY = 70;

export type PublicImageVariant = "list" | "detail";

function clampQuality(quality?: number) {
  if (!quality || Number.isNaN(quality)) {
    return DEFAULT_IMAGE_QUALITY;
  }

  return Math.max(MIN_IMAGE_QUALITY, Math.min(DEFAULT_IMAGE_QUALITY, quality));
}

function parseImageUrl(src: string) {
  try {
    return new URL(src, "https://moviebluebook.uk");
  } catch {
    return null;
  }
}

export function isOptimizableCoverImage(src: string) {
  const url = parseImageUrl(src);
  if (!url) return false;

  return (
    url.pathname.startsWith("/api/cdn/") ||
    url.pathname.startsWith("/api/notion/media/")
  );
}

export function isPublicImageUrlAllowed(src: string) {
  const url = parseImageUrl(src);
  if (!url) return false;

  if (url.pathname.startsWith("/api/cdn/")) return true;
  if (url.pathname.startsWith("/api/notion/media/")) return true;

  return [
    "www.notion.so",
    "notion.so",
    "secure.notion-static.com",
    "prod-files-secure.s3.us-west-2.amazonaws.com",
  ].includes(url.hostname);
}

function buildSizedImageUrl(src: string, width: number, quality: number) {
  const url = parseImageUrl(src);
  if (!url) return src;

  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));

  return url.origin === "https://moviebluebook.uk"
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

function widthsForVariant(variant: PublicImageVariant) {
  return variant === "list" ? LIST_IMAGE_WIDTHS : DEFAULT_IMAGE_WIDTHS;
}

function qualityForVariant(variant: PublicImageVariant) {
  return variant === "list" ? LIST_IMAGE_QUALITY : DEFAULT_IMAGE_QUALITY;
}

export function buildResponsiveImageAttrs(
  src: string,
  sizes: string,
  options?: { quality?: number; variant?: PublicImageVariant }
) {
  if (!isOptimizableCoverImage(src)) {
    return { src, sizes };
  }

  const variant: PublicImageVariant = options?.variant ?? "detail";
  const explicitQuality = options?.quality;
  const quality = clampQuality(
    explicitQuality ?? qualityForVariant(variant)
  );
  const widths = widthsForVariant(variant);
  const max = widths[widths.length - 1] ?? DEFAULT_IMAGE_WIDTHS.at(-1) ?? 1200;

  return {
    src: buildSizedImageUrl(src, max, quality),
    srcSet: widths
      .map((width) => `${buildSizedImageUrl(src, width, quality)} ${width}w`)
      .join(", "),
    sizes,
  };
}

export function getCoverImageLoading(
  index: number,
  variant: PublicImageVariant = "detail"
) {
  if (index === 0) {
    return {
      loading: "eager" as const,
      fetchPriority: "high" as const,
    };
  }

  return {
    loading: "lazy" as const,
    fetchPriority: "auto" as const,
  };
}
