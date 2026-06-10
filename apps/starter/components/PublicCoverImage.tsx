import {
  buildResponsiveImageAttrs,
  getCoverImageLoading,
  type PublicImageVariant,
} from "@/lib/public-image";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className: string;
  index?: number;
  variant?: PublicImageVariant;
};

export function PublicCoverImage({
  src,
  alt,
  sizes,
  className,
  index = 1,
  variant = "detail",
}: Props) {
  const image = buildResponsiveImageAttrs(src, sizes, { variant });
  const loading = getCoverImageLoading(index, variant);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.sizes}
      alt={alt}
      className={className}
      loading={loading.loading}
      fetchPriority={loading.fetchPriority}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
