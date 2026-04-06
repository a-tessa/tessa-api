import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import { serializeUserResponse, serializeUsersListResponse } from "./users.serializers.js";
import { createAdminSchema, pageListQuerySchema, updateStatusSchema, userIdParamsSchema } from "./users.schemas.js";
import { createAdminUser, listUsers, updateUserStatus } from "./users.service.js";

export const usersRouter = new Hono<AppBindings>();

usersRouter.use("*", requireAuth, requireRole(["MASTER"]));

usersRouter.get("/", zValidator("query", pageListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await listUsers(query);

  return c.json(serializeUsersListResponse(result));
});

usersRouter.post("/", zValidator("json", createAdminSchema), async (c) => {
  const input = c.req.valid("json");
  const user = await createAdminUser(input);

  return c.json(serializeUserResponse(user), 201);
});

usersRouter.patch(
  "/:id/status",
  zValidator("param", userIdParamsSchema),
  zValidator("json", updateStatusSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = await updateUserStatus(id, input);

    return c.json(serializeUserResponse(user));
  }
);
