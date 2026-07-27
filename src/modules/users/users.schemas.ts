import { z } from "zod";
import {
  formatBrazilPhoneDisplay,
  isValidBrazilPhone,
  isValidCpf,
  normalizeCpfDigits
} from "../../lib/brazil-ids.js";

const nonEmptyString = z.string().trim().min(1);

/** Empty string clears the field (null). Undefined leaves it unchanged. */
const optionalCpfSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const digits = normalizeCpfDigits(trimmed);
    if (!isValidCpf(digits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF inválido."
      });
      return z.NEVER;
    }

    return digits;
  });

const optionalPhoneSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (!isValidBrazilPhone(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone inválido."
      });
      return z.NEVER;
    }

    return formatBrazilPhoneDisplay(trimmed);
  });

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

export const updateUserProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  cpf: optionalCpfSchema,
  phone: optionalPhoneSchema,
  removeAvatar: z.boolean().optional()
});
