import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_UNPOOLED: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres."),
  MASTER_SETUP_KEY: z.string().min(8, "MASTER_SETUP_KEY precisa ter ao menos 8 caracteres."),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  ASSET_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(4 * 1024 * 1024),
  DOCUMENT_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(50 * 1024 * 1024),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_TRANSLATION_MODEL: z.string().min(1).default("gpt-5.4-nano"),
  TRANSLATION_WORKER_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  TRANSLATION_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_NOTIFICATION_EMAIL: z
    .string()
    .email()
    .default("contato.tessa.estruturas@gmail.com"),
  CONTACT_EMAIL_FROM: z.string().min(1).optional(),
  INSTAGRAM_APP_ID: z.string().min(1).optional(),
  INSTAGRAM_APP_SECRET: z.string().min(1).optional(),
  INSTAGRAM_REDIRECT_URI: z.string().url().optional(),
  INSTAGRAM_FACEBOOK_PAGE_ID: z.string().min(1).optional(),
  INSTAGRAM_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  INSTAGRAM_CONTENT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ADMIN_APP_URL: z.string().url().optional()
});

export const env = envSchema.parse(process.env);
