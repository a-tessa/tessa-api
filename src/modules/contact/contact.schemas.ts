import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

export const createContactSchema = z.object({
  fullName: nonEmptyString.max(200),
  email: z.string().email(),
  phone: nonEmptyString.max(30),
  companyName: nonEmptyString.max(200),
  city: nonEmptyString.max(100),
  state: z.enum(BR_STATES),
  service: z.string().trim().max(200).nullish(),
  message: z.string().trim().max(2000).nullish()
});

export const contactListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const contactIdParamsSchema = z.object({
  id: nonEmptyString
});

export const updateContactStatusSchema = z.object({
  hasBeenContacted: z.boolean()
});
