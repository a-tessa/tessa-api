import { getYouTubeVideoId } from "../content/content.youtube.js";
import type {
  GalleryMediaItemAdminDto,
  GalleryMediaItemAdminResponseDto,
  GalleryMediaItemPublicDto,
  GalleryMediaItemRecord,
  GalleryMediaItemsAdminListResponseDto,
  GalleryMediaItemsPublicListResponseDto
} from "./gallery.types.js";

function toAdminDto(record: GalleryMediaItemRecord): GalleryMediaItemAdminDto {
  return {
    id: record.id,
    kind: record.kind,
    alt: record.alt,
    caption: record.caption,
    categorySlug: record.categorySlug,
    order: record.order,
    imageUrl: record.imageUrl,
    imagePathname: record.imagePathname,
    imageMimeType: record.imageMimeType,
    imageSizeBytes: record.imageSizeBytes,
    imageOriginalFilename: record.imageOriginalFilename,
    youtubeUrl: record.youtubeUrl,
    youtubeVideoId: getYouTubeVideoId(record.youtubeUrl),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdById: record.createdById
  };
}

function toPublicDto(record: GalleryMediaItemRecord): GalleryMediaItemPublicDto {
  return {
    id: record.id,
    kind: record.kind,
    alt: record.alt,
    caption: record.caption,
    categorySlug: record.categorySlug,
    order: record.order,
    imageUrl: record.imageUrl,
    youtubeUrl: record.youtubeUrl,
    youtubeVideoId: getYouTubeVideoId(record.youtubeUrl)
  };
}

export function serializeGalleryMediaItemAdminResponse(
  record: GalleryMediaItemRecord
): GalleryMediaItemAdminResponseDto {
  return { item: toAdminDto(record) };
}

export function serializeGalleryMediaItemsAdminListResponse(
  items: GalleryMediaItemRecord[]
): GalleryMediaItemsAdminListResponseDto {
  return { items: items.map(toAdminDto) };
}

export function serializeGalleryMediaItemsPublicListResponse(
  items: GalleryMediaItemRecord[]
): GalleryMediaItemsPublicListResponseDto {
  return { items: items.map(toPublicDto) };
}
