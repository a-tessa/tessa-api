import { z } from "zod";

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const allowedImageMimeTypeSchema = z.enum(allowedImageMimeTypes);

export const heroSectionImageUploadParamsSchema = z.object({
  topicIndex: z.coerce.number().int().min(0).max(2)
});

export const heroSectionImageUploadFormSchema = z.object({
  alt: z.string().trim().min(1).max(255).optional()
});
