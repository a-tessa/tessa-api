import { z } from "zod";

const passwordSchema = z.string().min(8, "Senha precisa ter ao menos 8 caracteres.");

export const bootstrapSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  setupKey: z.string().min(8)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: passwordSchema
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token inválido."),
  newPassword: passwordSchema
});
