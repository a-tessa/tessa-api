import { zValidator } from "@hono/zod-validator";
import { UserRole } from "@prisma/client";
import { Hono } from "hono";
import { z } from "zod";
import { hashPassword } from "../lib/auth.js";
import { conflict, notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import type { AppBindings } from "../types.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const createAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const updateStatusSchema = z.object({
  isActive: z.boolean()
});

export const usersRouter = new Hono<AppBindings>();

usersRouter.use("*", requireAuth, requireRole(["MASTER"]));

usersRouter.get("/", async (c) => {
  const users = await prisma.user.findMany({
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
  });

  return c.json({ users });
});

usersRouter.post("/", zValidator("json", createAdminSchema), async (c) => {
  const input = c.req.valid("json");
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (existingUser) {
    conflict("Já existe um usuário com este email.");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      role: UserRole.ADMIN
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  return c.json({ user }, 201);
});

usersRouter.patch("/:id/status", zValidator("json", updateStatusSchema), async (c) => {
  const input = c.req.valid("json");
  const { id } = c.req.param();

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

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { isActive: input.isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true
    }
  });

  return c.json({ user: updatedUser });
});
