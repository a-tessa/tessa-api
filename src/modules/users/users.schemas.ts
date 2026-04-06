import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const pageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const userIdParamsSchema = z.object({
  id: nonEmptyString
});

export const createAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export const updateStatusSchema = z.object({
  isActive: z.boolean()
});
