import { Hono } from "hono";
import type { AppBindings } from "../../types.js";
import { serializePublicContentResponse } from "./content.serializers.js";
import { getPublicContent } from "./content.service.js";

export const publicContentRouter = new Hono<AppBindings>();

publicContentRouter.get("/", async (c) => {
  const content = await getPublicContent();
  return c.json(serializePublicContentResponse(content));
});
