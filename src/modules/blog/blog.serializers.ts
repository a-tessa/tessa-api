import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  BlogArticleAdminListItem,
  BlogArticleDto,
  BlogArticleListItem,
  BlogArticleRecord,
  BlogArticleResponseDto,
  BlogArticlesAdminListResponseDto,
  BlogArticlesAdminListResult,
  BlogArticlesListResponseDto,
  BlogArticlesListResult,
  BlogBodyImageUploadResponseDto
} from "./blog.types.js";

export function serializeBlogArticle(record: BlogArticleRecord): BlogArticleDto {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    content: record.content,
    categorySlug: record.categorySlug,
    headerImageUrl: record.headerImageUrl,
    headerImageAlt: record.headerImageAlt,
    status: record.status,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: record.author
  };
}

export function serializeBlogArticleListItem(record: BlogArticleListItem): BlogArticleListItem {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    content: record.content,
    categorySlug: record.categorySlug,
    headerImageUrl: record.headerImageUrl,
    headerImageAlt: record.headerImageAlt,
    status: record.status,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: record.author
  };
}

export function serializeBlogArticleResponse(record: BlogArticleRecord): BlogArticleResponseDto {
  return { article: serializeBlogArticle(record) };
}

export function serializeBlogArticleAdminListItem(
  record: BlogArticleAdminListItem
): BlogArticleAdminListItem {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    content: record.content,
    categorySlug: record.categorySlug,
    headerImageUrl: record.headerImageUrl,
    headerImageAlt: record.headerImageAlt,
    status: record.status,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: record.author,
    availableLocales: record.availableLocales
  };
}

export function serializeBlogArticlesListResponse(
  result: BlogArticlesListResult
): BlogArticlesListResponseDto {
  return {
    articles: result.articles.map(serializeBlogArticleListItem),
    pagination: serializePagination(result.pagination)
  };
}

export function serializeBlogArticlesAdminListResponse(
  result: BlogArticlesAdminListResult
): BlogArticlesAdminListResponseDto {
  return {
    articles: result.articles.map(serializeBlogArticleAdminListItem),
    pagination: serializePagination(result.pagination)
  };
}

export function serializeBlogBodyImageUploadResponse(
  url: string
): BlogBodyImageUploadResponseDto {
  return { url };
}
