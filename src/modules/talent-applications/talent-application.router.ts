import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { rateLimiter } from "../../middlewares/rate-limit.js";
import type { AppBindings } from "../../types.js";
import { sendTalentApplicationNotificationEmail } from "./talent-application.email.js";
import {
  createTalentApplicationSchema,
  talentApplicationIdParamsSchema,
  talentApplicationListQuerySchema
} from "./talent-application.schemas.js";
import {
  serializeTalentApplicationListResponse,
  serializeTalentApplicationResponse
} from "./talent-application.serializers.js";
import {
  createTalentApplication,
  deleteTalentApplication,
  listTalentApplications
} from "./talent-application.service.js";

export const talentApplicationRouter = new Hono<AppBindings>();

const submitRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5
});

talentApplicationRouter.post(
  "/",
  submitRateLimit,
  zValidator("json", createTalentApplicationSchema),
  async (c) => {
    const input = c.req.valid("json");
    const application = await createTalentApplication(input);

    try {
      await sendTalentApplicationNotificationEmail(application);
    } catch (error) {
      console.error("[talent-application-email] Falha ao enviar notificação:", error);
    }

    return c.json(serializeTalentApplicationResponse(application), 201);
  }
);

talentApplicationRouter.use("/admin", requireAuth, requireRole(["MASTER", "ADMIN"]));
talentApplicationRouter.use("/admin/*", requireAuth, requireRole(["MASTER", "ADMIN"]));

talentApplicationRouter.get(
  "/admin",
  zValidator("query", talentApplicationListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listTalentApplications(query);

    return c.json(serializeTalentApplicationListResponse(result));
  }
);

talentApplicationRouter.delete(
  "/admin/:id",
  zValidator("param", talentApplicationIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteTalentApplication(id);

    return c.json({ message: "Cadastro removido." });
  }
);
