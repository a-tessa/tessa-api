import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import {
  serializeAdminNpsResponseListResponse,
  serializeAdminNpsResponseResponse,
  serializePublicNpsResponseListResponse
} from "./nps.serializers.js";
import {
  createNpsResponseSchema,
  npsResponseIdParamsSchema,
  npsResponseListQuerySchema,
  updateNpsResponseModerationSchema
} from "./nps.schemas.js";
import {
  createNpsResponse,
  deleteNpsResponse,
  getNpsResponseById,
  listApprovedNpsResponses,
  listNpsResponses,
  updateNpsResponseModeration
} from "./nps.service.js";

export const npsRouter = new Hono<AppBindings>();

npsRouter.get("/responses", async (c) => {
  const responses = await listApprovedNpsResponses();

  return c.json(serializePublicNpsResponseListResponse(responses));
});

npsRouter.post("/responses", zValidator("json", createNpsResponseSchema), async (c) => {
  const input = c.req.valid("json");
  const response = await createNpsResponse(input);

  return c.json(serializeAdminNpsResponseResponse(response), 201);
});

npsRouter.use("/admin", requireAuth, requireRole(["MASTER", "ADMIN"]));
npsRouter.use("/admin/*", requireAuth, requireRole(["MASTER", "ADMIN"]));

npsRouter.get(
  "/admin/responses",
  zValidator("query", npsResponseListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listNpsResponses(query);

    return c.json(serializeAdminNpsResponseListResponse(result));
  }
);

npsRouter.get(
  "/admin/responses/:id",
  zValidator("param", npsResponseIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const response = await getNpsResponseById(id);

    return c.json(serializeAdminNpsResponseResponse(response));
  }
);

npsRouter.patch(
  "/admin/responses/:id/moderation",
  zValidator("param", npsResponseIdParamsSchema),
  zValidator("json", updateNpsResponseModerationSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = c.get("user");
    const response = await updateNpsResponseModeration(id, input, user.id);

    return c.json(serializeAdminNpsResponseResponse(response));
  }
);

npsRouter.delete(
  "/admin/responses/:id",
  zValidator("param", npsResponseIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteNpsResponse(id);

    return c.json({ message: "Resposta de NPS removida." });
  }
);
