import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres."),
  MASTER_SETUP_KEY: z.string().min(8, "MASTER_SETUP_KEY precisa ter ao menos 8 caracteres.")
});

export const env = envSchema.parse(process.env);
