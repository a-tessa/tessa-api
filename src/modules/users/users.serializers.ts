import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  ManagedUserDto,
  ManagedUserRecord,
  UserResponseDto,
  UsersListResponseDto,
  UsersListResult
} from "./users.types.js";

export function serializeManagedUser(user: ManagedUserRecord): ManagedUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function serializeUsersListResponse(input: UsersListResult): UsersListResponseDto {
  return {
    users: input.users.map(serializeManagedUser),
    pagination: serializePagination(input.pagination)
  };
}

export function serializeUserResponse(user: ManagedUserRecord): UserResponseDto {
  return {
    user: serializeManagedUser(user)
  };
}
