import type { DocumentLocale } from "@prisma/client";
import type { z } from "zod";
import type { ContentLocale } from "../translation/translation.types.js";
import type {
  createDocumentSchema,
  persistDocumentFileSchema,
  updateDocumentSchema
} from "./documents.schemas.js";

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type PersistDocumentFileInput = z.infer<typeof persistDocumentFileSchema>;

export type DocumentFileRecord = {
  id: string;
  locale: DocumentLocale;
  url: string;
  pathname: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  coverImageUrl: string | null;
  coverImagePathname: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRecord = {
  id: string;
  title: string;
  titleEn: string | null;
  titleEs: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  categorySlug: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  files: DocumentFileRecord[];
};

export type DocumentAdminListItem = DocumentRecord & {
  availableLocales: ContentLocale[];
};

export type DocumentFileDto = {
  id: string;
  locale: ContentLocale;
  url: string;
  pathname: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  coverImageUrl: string | null;
  coverImagePathname: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentAdminDto = {
  id: string;
  title: string;
  titleEn: string | null;
  titleEs: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionEs: string | null;
  categorySlug: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  files: DocumentFileDto[];
  availableLocales: ContentLocale[];
};

export type DocumentPublicDto = {
  id: string;
  title: string;
  description: string | null;
  categorySlug: string;
  order: number;
  coverImageUrl: string | null;
  file: {
    url: string;
    originalFilename: string | null;
    sizeBytes: number;
  };
};

export type DocumentsAdminListResponseDto = {
  documents: DocumentAdminDto[];
};

export type DocumentAdminResponseDto = {
  document: DocumentAdminDto;
};

export type DocumentsPublicListResponseDto = {
  documents: DocumentPublicDto[];
};
