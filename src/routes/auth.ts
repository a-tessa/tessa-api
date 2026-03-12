import { zValidator } from "@hono/zod-validator";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../env.js";
import { createAccessToken, hashPassword, verifyPassword } from "../lib/auth.js";
import { conflict, unauthorized } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middlewares/auth.js";

const bootstrapSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  setupKey: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = new Hono<AppBindings>();

authRouter.post("/bootstrap", zValidator("json", bootstrapSchema), async (c) => {
  const input = c.req.valid("json");

  if (input.setupKey !== env.MASTER_SETUP_KEY) {
    unauthorized("Chave de bootstrap inválida.");
  }

  const masterExists = await prisma.user.findFirst({
    where: { role: UserRole.MASTER }
  });

  if (masterExists) {
    conflict("Usuário master já foi criado.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (existingUser) {
    conflict("Já existe um usuário com este email.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: UserRole.MASTER
    }
  });

  const accessToken = await createAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return c.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken
    },
    201
  );
});

authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
  const input = c.req.valid("json");

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
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

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    accessToken
  });
});

authRouter.get("/me", requireAuth, async (c) => {
  const authUser = c.get("user");
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
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

  return c.json({ user });
});
