import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth } from "../../middlewares/auth.js";
import { rateLimiter } from "../../middlewares/rate-limit.js";
import type { AppBindings } from "../../types.js";
import { parseUpdateUserProfileRequest } from "../users/users.profile.utils.js";
import { updateUserProfile } from "../users/users.service.js";
import { serializeAuthSessionResponse, serializeCurrentUserResponse } from "./auth.serializers.js";
import { bootstrapSchema, loginSchema } from "./auth.schemas.js";
import { bootstrapMasterUser, getCurrentUser, loginUser } from "./auth.service.js";

const authRateLimit = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

export const authRouter = new Hono<AppBindings>();

authRouter.post("/bootstrap", authRateLimit, zValidator("json", bootstrapSchema), async (c) => {
  const input = c.req.valid("json");
  const session = await bootstrapMasterUser(input);

  return c.json(serializeAuthSessionResponse(session), 201);
});

authRouter.post("/login", authRateLimit, zValidator("json", loginSchema), async (c) => {
  const input = c.req.valid("json");
  const session = await loginUser(input);

  return c.json(serializeAuthSessionResponse(session));
});

authRouter.get("/me", requireAuth, async (c) => {
  const authUser = c.get("user");
  const user = await getCurrentUser(authUser.id);

  return c.json(serializeCurrentUserResponse(user));
});

authRouter.patch("/me", requireAuth, async (c) => {
  const authUser = c.get("user");
  const contentType = c.req.header("content-type") ?? "";
  const formData = contentType.startsWith("multipart/form-data")
    ? await c.req.formData()
    : undefined;
  const body = formData ? undefined : await c.req.json();
  const { input, avatarFile } = parseUpdateUserProfileRequest(contentType, body, formData);
  const user = await updateUserProfile(authUser.id, input, avatarFile);

  return c.json(serializeCurrentUserResponse(user));
});
