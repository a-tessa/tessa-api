import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";
import { env } from "../env.js";
import type { JwtPayload, UserRole } from "../types.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAccessToken(input: {
  id: string;
  email: string;
  role: UserRole;
}) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  return sign(
    {
      sub: input.id,
      email: input.email,
      role: input.role,
      exp
    },
    env.JWT_SECRET
  );
}

export async function decodeAccessToken(token: string) {
  const payload = await verify(token, env.JWT_SECRET);

  return payload as JwtPayload;
}
