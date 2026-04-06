import type {
  AuthSessionResponseDto,
  AuthSessionResult,
  AuthUserDto,
  CurrentUserDto,
  CurrentUserRecord,
  CurrentUserResponseDto
} from "./auth.types.js";

export function serializeAuthUser(user: AuthSessionResult["user"]): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export function serializeAuthSessionResponse(
  session: AuthSessionResult
): AuthSessionResponseDto {
  return {
    user: serializeAuthUser(session.user),
    accessToken: session.accessToken
  };
}

export function serializeCurrentUser(user: CurrentUserRecord): CurrentUserDto {
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

export function serializeCurrentUserResponse(
  user: CurrentUserRecord
): CurrentUserResponseDto {
  return {
    user: serializeCurrentUser(user)
  };
}
