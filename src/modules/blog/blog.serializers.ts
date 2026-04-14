import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  BlogArticleDto,
  BlogArticleListItem,
  BlogArticleRecord,
  BlogArticleResponseDto,
  BlogArticlesListResponseDto,
  BlogArticlesListResult
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
    categorySlug: record.categorySlug,
    headerImageUrl: record.headerImageUrl,
    headerImageAlt: record.headerImageAlt,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: record.author
  };
}

export function serializeBlogArticleResponse(record: BlogArticleRecord): BlogArticleResponseDto {
  return { article: serializeBlogArticle(record) };
}

export function serializeBlogArticlesListResponse(
  result: BlogArticlesListResult
): BlogArticlesListResponseDto {
  return {
    articles: result.articles.map(serializeBlogArticleListItem),
    pagination: serializePagination(result.pagination)
  };
}
