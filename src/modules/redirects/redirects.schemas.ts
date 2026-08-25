import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const redirectSourceSchema = z.enum(["manual", "slugChange"]);
export const redirectStatusCodeSchema = z.union([z.literal(301), z.literal(302)]);

export const redirectListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).max(200).optional()
});

export const redirectIdParamsSchema = z.object({
  id: nonEmptyString
});

export const createRedirectSchema = z.object({
  fromPath: nonEmptyString,
  toPath: nonEmptyString,
  statusCode: redirectStatusCodeSchema.default(301)
});

export const updateRedirectSchema = z.object({
  fromPath: nonEmptyString.optional(),
  toPath: nonEmptyString.optional(),
  statusCode: redirectStatusCodeSchema.optional()
});
