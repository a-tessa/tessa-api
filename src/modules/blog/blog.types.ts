import type { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import type {
  blogArticleSlugParamsSchema,
  blogArticleStatusSchema,
  blogListQuerySchema,
  createBlogArticleSchema,
  updateBlogArticleSchema
} from "./blog.schemas.js";

export type BlogArticleStatus = z.infer<typeof blogArticleStatusSchema>;
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
  status: BlogArticleStatus;
  publishedAt: Date | null;
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

export type BlogArticleListItem = BlogArticleRecord;

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

export type BlogBodyImageUploadResponseDto = {
  url: string;
};
