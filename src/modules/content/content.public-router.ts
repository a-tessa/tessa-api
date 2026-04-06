import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppBindings } from "../../types.js";
import { serializePublicPageResponse } from "./content.serializers.js";
import { getPublishedPage } from "./content.service.js";
import { slugParamsSchema } from "./content.schemas.js";

export const publicContentRouter = new Hono<AppBindings>();

publicContentRouter.get("/pages/:slug", zValidator("param", slugParamsSchema), async (c) => {
  const { slug } = c.req.valid("param");
  const page = await getPublishedPage(slug);

  return c.json(serializePublicPageResponse(page));
});
