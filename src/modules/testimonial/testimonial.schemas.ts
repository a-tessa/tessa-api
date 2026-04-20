import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const testimonialStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const createTestimonialSchema = z.object({
  authorName: nonEmptyString.max(120),
  authorRole: z.string().trim().max(120).optional(),
  companyName: z.string().trim().max(200).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(500),
  question: z.string().trim().max(300).optional()
});

export const testimonialListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: testimonialStatusSchema.optional()
});

export const testimonialIdParamsSchema = z.object({
  id: nonEmptyString
});

export const updateTestimonialModerationSchema = z.object({
  status: z.enum(["approved", "rejected"])
});
