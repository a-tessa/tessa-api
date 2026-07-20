import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const contentLocaleSchema = z.enum(["pt-BR", "en", "es"]);

export const documentIdParamsSchema = z.object({
  id: nonEmptyString
});

export const documentFileParamsSchema = z.object({
  id: nonEmptyString,
  locale: contentLocaleSchema
});

export const documentsListQuerySchema = z.object({
  categorySlug: z.string().trim().optional()
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  titleEn: z.string().trim().max(200).optional().nullable(),
  titleEs: z.string().trim().max(200).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionEs: z.string().trim().max(2000).optional().nullable(),
  categorySlug: nonEmptyString,
  order: z.coerce.number().int().min(0).max(9999).default(0)
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  titleEn: z.string().trim().max(200).optional().nullable(),
  titleEs: z.string().trim().max(200).optional().nullable(),
  descriptionEn: z.string().trim().max(2000).optional().nullable(),
  descriptionEs: z.string().trim().max(2000).optional().nullable(),
  categorySlug: nonEmptyString.optional(),
  order: z.coerce.number().int().min(0).max(9999).optional()
});

export const persistDocumentFileSchema = z.object({
  url: z.string().url(),
  pathname: nonEmptyString,
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().trim().max(255).optional().nullable()
});

export const blobUploadClientPayloadSchema = z.object({
  token: nonEmptyString,
  documentId: nonEmptyString,
  locale: contentLocaleSchema
});
