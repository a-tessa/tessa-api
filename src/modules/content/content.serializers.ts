import type {
  AdminContentRecord,
  AdminContentResponseDto,
  CollectionItemResponseDto,
  CollectionKey,
  CollectionResponseDto,
  DraftServicesPageItem,
  DraftContent,
  PublicContentRecord,
  PublicContentResponseDto,
  SectionResponseDto,
  ServicePageResponseDto,
  ServicePagesResponseDto,
  SingularSectionKey,
  StoredCollectionItem
} from "./content.types.js";

export function serializePublicContentResponse(
  content: PublicContentRecord
): PublicContentResponseDto {
  return {
    content: content.content,
    publishedAt: content.publishedAt,
    updatedAt: content.updatedAt
  };
}

export function serializeAdminContentResponse(
  content: AdminContentRecord
): AdminContentResponseDto {
  return {
    content: content.content,
    publishedContent: content.publishedContent,
    status: content.status,
    publishedAt: content.publishedAt,
    updatedAt: content.updatedAt
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

export function serializeServicePageResponse(
  item: DraftServicesPageItem
): ServicePageResponseDto {
  return { item };
}

export function serializeServicePagesResponse(
  servicesPages: DraftServicesPageItem[]
): ServicePagesResponseDto {
  return { servicesPages };
}
