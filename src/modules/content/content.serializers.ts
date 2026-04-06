import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  AdminPageDto,
  AdminPageRecord,
  AdminPageResponseDto,
  AdminPageSummaryDto,
  AdminPageSummaryRecord,
  CollectionItemResponseDto,
  CollectionKey,
  CollectionResponseDto,
  ContentPagesListResponseDto,
  ContentPagesListResult,
  DraftContent,
  PublicPageDto,
  PublicPageRecord,
  PublicPageResponseDto,
  SectionResponseDto,
  SingularSectionKey,
  StoredCollectionItem
} from "./content.types.js";

export function serializePublicPage(page: PublicPageRecord): PublicPageDto {
  return {
    slug: page.slug,
    title: page.title,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    publishedContent: page.publishedContent,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt
  };
}

export function serializePublicPageResponse(page: PublicPageRecord): PublicPageResponseDto {
  return {
    page: serializePublicPage(page)
  };
}

export function serializeAdminPageSummary(page: AdminPageSummaryRecord): AdminPageSummaryDto {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedAt
  };
}

export function serializeAdminPagesResponse(
  input: ContentPagesListResult
): ContentPagesListResponseDto {
  return {
    pages: input.pages.map(serializeAdminPageSummary),
    pagination: serializePagination(input.pagination)
  };
}

export function serializeAdminPage(page: AdminPageRecord): AdminPageDto {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    status: page.status,
    draftContent: page.draftContent,
    publishedContent: page.publishedContent,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    createdAt: page.createdAt,
    updatedById: page.updatedById,
    publishedById: page.publishedById
  };
}

export function serializeAdminPageResponse(page: AdminPageRecord): AdminPageResponseDto {
  return {
    page: serializeAdminPage(page)
  };
}

export function serializeSectionResponse<K extends SingularSectionKey>(
  key: K,
  value: NonNullable<DraftContent[K]>
): SectionResponseDto<K> {
  return {
    [key]: value
  } as SectionResponseDto<K>;
}

export function serializeCollectionResponse<K extends CollectionKey>(
  key: K,
  items: StoredCollectionItem[]
): CollectionResponseDto<K> {
  return {
    [key]: items
  } as CollectionResponseDto<K>;
}

export function serializeCollectionItemResponse(
  item: StoredCollectionItem
): CollectionItemResponseDto {
  return { item };
}
