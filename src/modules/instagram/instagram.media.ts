import type { InstagramMediaDto } from "./instagram.schemas.js";
import type { NormalizedInstagramMedia } from "./instagram.types.js";

function firstCarouselImageUrl(media: InstagramMediaDto): string | null {
  const children = media.children?.data ?? [];

  for (const child of children) {
    if (child.media_type === "VIDEO" && child.thumbnail_url) {
      return child.thumbnail_url;
    }
    if (child.media_url) {
      return child.media_url;
    }
  }

  return null;
}

export function resolveMediaImageSourceUrl(media: InstagramMediaDto): string | null {
  switch (media.media_type) {
    case "IMAGE":
      return media.media_url ?? null;
    case "VIDEO":
      return media.thumbnail_url ?? media.media_url ?? null;
    case "CAROUSEL_ALBUM":
      return firstCarouselImageUrl(media) ?? media.media_url ?? media.thumbnail_url ?? null;
    default:
      return null;
  }
}

export function normalizeInstagramMedia(
  media: InstagramMediaDto,
  isCollaborative = false
): NormalizedInstagramMedia | null {
  const imageSourceUrl = resolveMediaImageSourceUrl(media);
  if (!imageSourceUrl) {
    return null;
  }

  const publishedAt = new Date(media.timestamp);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  return {
    instagramMediaId: media.id,
    mediaType: media.media_type,
    caption: media.caption?.trim() ? media.caption.trim() : null,
    altText: media.alt_text?.trim() ? media.alt_text.trim() : null,
    permalink: media.permalink,
    imageSourceUrl,
    isCollaborative,
    publishedAt
  };
}

export function normalizeInstagramMediaList(
  mediaList: InstagramMediaDto[],
  isCollaborative = false
): NormalizedInstagramMedia[] {
  const normalized: NormalizedInstagramMedia[] = [];

  for (const media of mediaList) {
    const item = normalizeInstagramMedia(media, isCollaborative);
    if (item) {
      normalized.push(item);
    }
  }

  return normalized;
}
