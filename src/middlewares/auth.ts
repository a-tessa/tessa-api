import type { MiddlewareHandler } from "hono";
import { prisma } from "../lib/prisma.js";
import { decodeAccessToken } from "../lib/auth.js";
import { forbidden, unauthorized } from "../lib/http.js";
import type { AppBindings, UserRole } from "../types.js";

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized();
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  let payload;
  try {
    payload = await decodeAccessToken(token);
  } catch {
    unauthorized("Token inválido ou expirado.");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    unauthorized("Usuário inválido ou inativo.");
    return;
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    role: user.role
  });

  await next();
};

export function requireRole(roles: UserRole[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get("user");

    if (!roles.includes(user.role)) {
      forbidden();
    }

    await next();
  };
}
