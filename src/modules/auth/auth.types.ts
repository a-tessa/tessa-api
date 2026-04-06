import { z } from "zod";
import type { UserRole } from "../../types.js";
import { bootstrapSchema, loginSchema } from "./auth.schemas.js";

export type BootstrapInput = z.infer<typeof bootstrapSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthSessionUserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type CurrentUserRecord = AuthSessionUserRecord & {
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
