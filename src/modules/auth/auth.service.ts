import { UserRole } from "@prisma/client";
import { env } from "../../env.js";
import { createAccessToken, hashPassword, verifyPassword } from "../../lib/auth.js";
import { conflict, unauthorized } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthSessionResult, BootstrapInput, CurrentUserRecord, LoginInput } from "./auth.types.js";

function normalizeEmail(email: string) {
  return email.toLowerCase();
}

export async function bootstrapMasterUser(input: BootstrapInput): Promise<AuthSessionResult> {
  if (input.setupKey !== env.MASTER_SETUP_KEY) {
    unauthorized("Chave de bootstrap inválida.");
  }

  const masterExists = await prisma.user.findFirst({
    where: { role: UserRole.MASTER }
  });

  if (masterExists) {
    conflict("Usuário master já foi criado.");
  }

  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    conflict("Já existe um usuário com este email.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash,
      role: UserRole.MASTER
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  const accessToken = await createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    user,
    accessToken
  };
}

export async function loginUser(input: LoginInput): Promise<AuthSessionResult> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || !user.isActive) {
    unauthorized("Credenciais inválidas.");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    unauthorized("Credenciais inválidas.");
  }

  const accessToken = await createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken
  };
}

export async function getCurrentUser(userId: string): Promise<CurrentUserRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    unauthorized("Usuário inválido ou inativo.");
  }

  return user;
}
