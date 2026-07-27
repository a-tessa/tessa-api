import { UserRole } from "@prisma/client";
import { env } from "../../env.js";
import { createAccessToken, hashPassword, verifyPassword } from "../../lib/auth.js";
import { badRequest, conflict, unauthorized } from "../../lib/http.js";
import {
  createPasswordResetToken,
  hashPasswordResetToken
} from "../../lib/mailer.js";
import { prisma } from "../../lib/prisma.js";
import { isAuthEmailConfigured, sendPasswordResetEmail } from "./auth.email.js";
import type {
  AuthSessionResult,
  BootstrapInput,
  ChangePasswordInput,
  CurrentUserRecord,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput
} from "./auth.types.js";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MINUTES = 60;

function normalizeEmail(email: string) {
  return email.toLowerCase();
}

function buildAdminAppUrl(pathname: string, search?: Record<string, string>): string {
  const base = env.ADMIN_APP_URL ?? "http://localhost:5173";
  const url = new URL(pathname, base.endsWith("/") ? base : `${base}/`);

  if (search) {
    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
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
      role: true,
      cpf: true,
      phone: true
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
      role: user.role,
      cpf: user.cpf,
      phone: user.phone
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
      cpf: true,
      phone: true,
      avatarUrl: true,
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

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true
    }
  });

  if (!user || !user.isActive) {
    unauthorized("Usuário inválido ou inativo.");
  }

  const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);

  if (!currentMatches) {
    badRequest("Senha atual incorreta.");
  }

  if (input.currentPassword === input.newPassword) {
    badRequest("A nova senha precisa ser diferente da senha atual.");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null
    }
  });
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true
    }
  });

  // Always succeed outwardly to avoid account enumeration.
  if (!user || !user.isActive) {
    return;
  }

  if (!isAuthEmailConfigured()) {
    console.error("[auth-email] E-mail não configurado; reset de senha não enviado.");
    return;
  }

  const rawToken = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt
    }
  });

  const resetUrl = buildAdminAppUrl("/redefinir-senha", { token: rawToken });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES
    });
  } catch (error) {
    console.error("[auth-email] Falha ao enviar e-mail de reset:", error);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null
      }
    });
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashPasswordResetToken(input.token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      isActive: true
    },
    select: {
      id: true,
      passwordResetExpiresAt: true
    }
  });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    badRequest("Link de redefinição inválido ou expirado.");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null
    }
  });
}
