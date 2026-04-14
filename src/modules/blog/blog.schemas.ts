import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const blogArticleSlugParamsSchema = z.object({
  slug: nonEmptyString
});

export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  categorySlug: z.string().trim().optional()
});

export const createBlogArticleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(1),
  categorySlug: nonEmptyString,
  headerImageAlt: z.string().trim().max(255).optional()
});

export const updateBlogArticleSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().trim().min(1).optional(),
  categorySlug: nonEmptyString.optional(),
  headerImageAlt: z.string().trim().max(255).optional(),
  removeHeaderImage: z.boolean().optional()
});
