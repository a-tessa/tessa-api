import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const npsResponseStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const createNpsResponseSchema = z.object({
  authorName: nonEmptyString.max(120),
  authorRole: z.string().trim().max(120).optional(),
  companyName: z.string().trim().max(200).optional(),
  score: z.coerce.number().int().min(0).max(10),
  comment: z.string().trim().min(1).max(2_000),
  question: z.string().trim().max(300).optional()
});

export const npsResponseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: npsResponseStatusSchema.optional()
});

export const npsResponseIdParamsSchema = z.object({
  id: nonEmptyString
});

export const updateNpsResponseModerationSchema = z.object({
  status: z.enum(["approved", "rejected"])
});
