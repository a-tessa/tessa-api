import type { GalleryMediaKind } from "@prisma/client";
import type { z } from "zod";
import type {
  createGalleryVideoSchema,
  updateGalleryMediaItemSchema
} from "./gallery.schemas.js";

export type CreateGalleryVideoInput = z.infer<typeof createGalleryVideoSchema>;
export type UpdateGalleryMediaItemInput = z.infer<typeof updateGalleryMediaItemSchema>;

export type GalleryMediaItemRecord = {
  id: string;
  kind: GalleryMediaKind;
  alt: string;
  caption: string | null;
  categorySlug: string | null;
  order: number;
  imageUrl: string | null;
  imagePathname: string | null;
  imageMimeType: string | null;
  imageSizeBytes: number | null;
  imageOriginalFilename: string | null;
  youtubeUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export type GalleryMediaItemAdminDto = {
  id: string;
  kind: GalleryMediaKind;
  alt: string;
  caption: string | null;
  categorySlug: string | null;
  order: number;
  imageUrl: string | null;
  imagePathname: string | null;
  imageMimeType: string | null;
  imageSizeBytes: number | null;
  imageOriginalFilename: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export type GalleryMediaItemPublicDto = {
  id: string;
  kind: GalleryMediaKind;
  alt: string;
  caption: string | null;
  categorySlug: string | null;
  order: number;
  imageUrl: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
};

export type GalleryMediaItemAdminResponseDto = {
  item: GalleryMediaItemAdminDto;
};

export type GalleryMediaItemsAdminListResponseDto = {
  items: GalleryMediaItemAdminDto[];
};

export type GalleryMediaItemsPublicListResponseDto = {
  items: GalleryMediaItemPublicDto[];
};
