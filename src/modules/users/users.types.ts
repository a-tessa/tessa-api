import { z } from "zod";
import type { UserRole } from "../../types.js";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  createAdminSchema,
  pageListQuerySchema,
  updateStatusSchema,
  updateUserProfileSchema,
  userIdParamsSchema
} from "./users.schemas.js";

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type PageListQuery = z.infer<typeof pageListQuerySchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export type ManagedUserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cpf: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ManagedUserDto = ManagedUserRecord;

export type UsersListResult = {
  users: ManagedUserRecord[];
  pagination: PaginationState;
};

export type UsersListResponseDto = {
  users: ManagedUserDto[];
  pagination: PaginationMetaDto;
};

export type UserResponseDto = {
  user: ManagedUserDto;
};
