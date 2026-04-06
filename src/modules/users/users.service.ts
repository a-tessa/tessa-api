import { UserRole } from "@prisma/client";
import { hashPassword } from "../../lib/auth.js";
import { conflict, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateAdminInput,
  ManagedUserRecord,
  PageListQuery,
  UpdateUserStatusInput,
  UsersListResult
} from "./users.types.js";

function normalizeEmail(email: string) {
  return email.toLowerCase();
}

export async function listUsers(query: PageListQuery): Promise<UsersListResult> {
  const skip = (query.page - 1) * query.perPage;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: query.perPage,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
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
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
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
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
