import { z } from "zod";
import type { UserRole } from "../../types.js";
import {
  bootstrapSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema
} from "./auth.schemas.js";

export type BootstrapInput = z.infer<typeof bootstrapSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type AuthSessionUserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cpf: string | null;
  phone: string | null;
};

export type CurrentUserRecord = AuthSessionUserRecord & {
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthSessionResult = {
  user: AuthSessionUserRecord;
  accessToken: string;
};

export type AuthUserDto = AuthSessionUserRecord;
export type CurrentUserDto = CurrentUserRecord;

export type AuthSessionResponseDto = {
  user: AuthUserDto;
  accessToken: string;
};

export type CurrentUserResponseDto = {
  user: CurrentUserDto;
};

export type MessageResponseDto = {
  message: string;
};
