import type { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import type {
  blogArticleSlugParamsSchema,
  blogListQuerySchema,
  createBlogArticleSchema,
  updateBlogArticleSchema
} from "./blog.schemas.js";

export type BlogArticleSlugParams = z.infer<typeof blogArticleSlugParamsSchema>;
export type BlogListQuery = z.infer<typeof blogListQuerySchema>;
export type CreateBlogArticleInput = z.infer<typeof createBlogArticleSchema>;
export type UpdateBlogArticleInput = z.infer<typeof updateBlogArticleSchema>;

export type BlogArticleRecord = {
  id: string;
  title: string;
  slug: string;
  content: string;
  categorySlug: string;
  headerImageUrl: string | null;
  headerImageAlt: string | null;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
  };
};

export type BlogArticleDto = Omit<BlogArticleRecord, "author"> & {
  author: { id: string; name: string };
};

export type BlogArticleListItem = Omit<BlogArticleRecord, "content">;

export type BlogArticlesListResult = {
  articles: BlogArticleListItem[];
  pagination: PaginationState;
};

export type BlogArticlesListResponseDto = {
  articles: BlogArticleListItem[];
  pagination: PaginationMetaDto;
};

export type BlogArticleResponseDto = {
  article: BlogArticleDto;
};
