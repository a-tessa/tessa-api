import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import {
  serializeRedirectListResponse,
  serializeRedirectResponse
} from "./redirects.serializers.js";
import {
  createRedirectSchema,
  redirectIdParamsSchema,
  redirectListQuerySchema,
  updateRedirectSchema
} from "./redirects.schemas.js";
import {
  createRedirect,
  deleteRedirect,
  listRedirects,
  updateRedirect
} from "./redirects.service.js";
import { publicRedirectsRouter } from "./redirects.public-router.js";

export const redirectsRouter = new Hono<AppBindings>();

redirectsRouter.route("/public", publicRedirectsRouter);

redirectsRouter.get(
  "/",
  requireAuth,
  zValidator("query", redirectListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listRedirects(query);
    return c.json(serializeRedirectListResponse(result));
  }
);

redirectsRouter.post(
  "/",
  requireAuth,
  zValidator("json", createRedirectSchema),
  async (c) => {
    const body = c.req.valid("json");
    const record = await createRedirect(body);
    return c.json(serializeRedirectResponse(record), 201);
  }
);

redirectsRouter.put(
  "/:id",
  requireAuth,
  zValidator("param", redirectIdParamsSchema),
  zValidator("json", updateRedirectSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const record = await updateRedirect(id, body);
    return c.json(serializeRedirectResponse(record));
  }
);

redirectsRouter.delete(
  "/:id",
  requireAuth,
  zValidator("param", redirectIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteRedirect(id);
    return c.json({ message: "Redirecionamento removido com sucesso." });
  }
);
