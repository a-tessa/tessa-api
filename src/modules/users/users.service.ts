import { UserRole } from "@prisma/client";
import { hashPassword } from "../../lib/auth.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import { buildUserAvatarPath } from "../assets/assets.utils.js";
import type {
  CreateAdminInput,
  ManagedUserRecord,
  PageListQuery,
  UpdateUserProfileInput,
  UpdateUserStatusInput,
  UsersListResult
} from "./users.types.js";

const managedUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} as const;

function normalizeEmail(email: string) {
  return email.toLowerCase();
}

async function uploadUserAvatar(userId: string, file: File) {
  const prepared = await prepareImageAsset(file);
  const pathname = buildUserAvatarPath(userId, prepared.originalFilename);
  const blob = await uploadPublicAsset(pathname, prepared);

  return { url: blob.url, pathname };
}

async function deleteUserAvatar(url: string | null) {
  if (!url) {
    return;
  }

  await deleteBlobAsset(url).catch(() => {});
}

export async function listUsers(query: PageListQuery): Promise<UsersListResult> {
  const skip = (query.page - 1) * query.perPage;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: query.perPage,
      orderBy: { createdAt: "asc" },
      select: managedUserSelect
    }),
    prisma.user.count()
  ]);

  return {
    users,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function createAdminUser(input: CreateAdminInput): Promise<ManagedUserRecord> {
  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    conflict("Já existe um usuário com este email.");
  }

  return prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await hashPassword(input.password),
      role: UserRole.ADMIN
    },
    select: managedUserSelect
  });
}

export async function updateUserProfile(
  id: string,
  input: UpdateUserProfileInput,
  avatarFile?: File | null
): Promise<ManagedUserRecord> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      avatarPathname: true
    }
  });

  if (!user) {
    notFound("Usuário não encontrado.");
  }

  const hasNameUpdate = input.name !== undefined;
  const hasEmailUpdate = input.email !== undefined;
  const hasAvatarUpload = avatarFile instanceof File && avatarFile.size > 0;
  const hasAvatarRemoval = input.removeAvatar === true;

  if (!hasNameUpdate && !hasEmailUpdate && !hasAvatarUpload && !hasAvatarRemoval) {
    badRequest("Informe ao menos um campo para atualizar.");
  }

  let nextEmail = user.email;

  if (hasEmailUpdate) {
    nextEmail = normalizeEmail(input.email!);

    if (nextEmail !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: nextEmail }
      });

      if (existingUser) {
        conflict("Já existe um usuário com este email.");
      }
    }
  }

  let nextAvatarUrl = user.avatarUrl;
  let nextAvatarPathname = user.avatarPathname;

  if (hasAvatarUpload) {
    const uploaded = await uploadUserAvatar(user.id, avatarFile!);
    await deleteUserAvatar(user.avatarUrl);
    nextAvatarUrl = uploaded.url;
    nextAvatarPathname = uploaded.pathname;
  } else if (hasAvatarRemoval) {
    await deleteUserAvatar(user.avatarUrl);
    nextAvatarUrl = null;
    nextAvatarPathname = null;
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(hasNameUpdate ? { name: input.name!.trim() } : {}),
      ...(hasEmailUpdate ? { email: nextEmail } : {}),
      ...(hasAvatarUpload || hasAvatarRemoval
        ? { avatarUrl: nextAvatarUrl, avatarPathname: nextAvatarPathname }
        : {})
    },
    select: managedUserSelect
  });
}

export async function updateUserStatus(
  id: string,
  input: UpdateUserStatusInput
): Promise<ManagedUserRecord> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true }
  });

  if (!user) {
    notFound("Usuário não encontrado.");
  }

  if (user.role === UserRole.MASTER) {
    conflict("O usuário master não pode ser desativado por esta rota.");
  }

  return prisma.user.update({
    where: { id },
    data: { isActive: input.isActive },
    select: managedUserSelect
  });
}
