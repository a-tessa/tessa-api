import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const TALENT_PRACTICE_AREAS = [
  "Produção",
  "Comercial",
  "Financeiro",
  "Atendimento ao Cliente",
  "Tecnologia",
  "Outro"
] as const;

export const talentPracticeAreaSchema = z.enum(TALENT_PRACTICE_AREAS);

export const TALENT_EDUCATION_LEVELS = [
  "Ensino Fundamental incompleto",
  "Ensino Fundamental completo",
  "Ensino Médio incompleto",
  "Ensino Médio completo",
  "Ensino Superior incompleto",
  "Ensino Superior completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado"
] as const;

export const talentEducationLevelSchema = z.enum(TALENT_EDUCATION_LEVELS);

/** DDD + 8 dígitos `(00) 0000-0000` ou DDD + 9 `(00) 00000-0000`. */
const brazilPhoneSchema = z
  .string()
  .trim()
  .regex(/^\(\d{2}\) (?:\d{4}-\d{4}|\d{5}-\d{4})$/);

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .regex(/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/);

export const talentApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const talentApplicationIdParamsSchema = z.object({
  id: nonEmptyString
});

export const createTalentApplicationSchema = z.object({
  fullName: nonEmptyString.min(2).max(200),
  email: emailSchema,
  phone: brazilPhoneSchema,
  educationLevel: talentEducationLevelSchema,
  education: nonEmptyString.min(2).max(200),
  practiceArea: talentPracticeAreaSchema,
  professionalSummary: nonEmptyString.min(10).max(2000)
});
