import { z } from "zod";

export const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const allowedImageMimeTypeSchema = z.enum(allowedImageMimeTypes);

export const heroSectionImageAltSchema = z.string().trim().min(1).max(255);
