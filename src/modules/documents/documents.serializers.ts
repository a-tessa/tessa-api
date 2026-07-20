import { toContentLocale } from "./documents.locale.js";
import type {
  DocumentAdminDto,
  DocumentAdminListItem,
  DocumentAdminResponseDto,
  DocumentFileDto,
  DocumentFileRecord,
  DocumentPublicDto,
  DocumentsAdminListResponseDto,
  DocumentsPublicListResponseDto
} from "./documents.types.js";

function serializeDocumentFile(file: DocumentFileRecord): DocumentFileDto {
  return {
    id: file.id,
    locale: toContentLocale(file.locale),
    url: file.url,
    pathname: file.pathname,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    originalFilename: file.originalFilename,
    coverImageUrl: file.coverImageUrl,
    coverImagePathname: file.coverImagePathname,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt
  };
}

export function serializeDocumentAdmin(record: DocumentAdminListItem): DocumentAdminDto {
  return {
    id: record.id,
    title: record.title,
    titleEn: record.titleEn,
    titleEs: record.titleEs,
    description: record.description,
    descriptionEn: record.descriptionEn,
    descriptionEs: record.descriptionEs,
    categorySlug: record.categorySlug,
    order: record.order,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    files: record.files.map(serializeDocumentFile),
    availableLocales: record.availableLocales
  };
}

export function serializeDocumentAdminResponse(
  record: DocumentAdminListItem
): DocumentAdminResponseDto {
  return { document: serializeDocumentAdmin(record) };
}

export function serializeDocumentsAdminListResponse(
  documents: DocumentAdminListItem[]
): DocumentsAdminListResponseDto {
  return {
    documents: documents.map(serializeDocumentAdmin)
  };
}

export function serializeDocumentPublic(record: DocumentPublicDto): DocumentPublicDto {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    categorySlug: record.categorySlug,
    order: record.order,
    coverImageUrl: record.coverImageUrl,
    file: record.file
  };
}

export function serializeDocumentsPublicListResponse(
  documents: DocumentPublicDto[]
): DocumentsPublicListResponseDto {
  return { documents };
}
