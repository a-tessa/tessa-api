import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const blogArticleStatusSchema = z.enum(["draft", "published"]);

export const blogArticleSlugParamsSchema = z.object({
  slug: nonEmptyString
});

export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  categorySlug: z.string().trim().optional(),
  status: blogArticleStatusSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  order: z.enum(["asc", "desc"]).default("desc")
});

export const createBlogArticleSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    content: z.string().optional().default(""),
    categorySlug: nonEmptyString,
    headerImageAlt: z.string().trim().max(255).optional(),
    status: blogArticleStatusSchema.default("draft")
  })
  .superRefine((data, ctx) => {
    if (data.status === "published" && data.content.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Conteúdo é obrigatório para publicar o artigo.",
        path: ["content"]
      });
    }
  });

export const updateBlogArticleSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().optional(),
  categorySlug: nonEmptyString.optional(),
  headerImageAlt: z.string().trim().max(255).optional(),
  removeHeaderImage: z.boolean().optional(),
  status: blogArticleStatusSchema.optional()
});
