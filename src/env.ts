import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_UNPOOLED: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres."),
  MASTER_SETUP_KEY: z.string().min(8, "MASTER_SETUP_KEY precisa ter ao menos 8 caracteres."),
  TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN: z.string().min(1).optional(),
  ASSET_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(4 * 1024 * 1024)
});

export const env = envSchema.parse(process.env);
