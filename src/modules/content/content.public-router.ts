import { Hono } from "hono";
import type { AppBindings } from "../../types.js";
import { normalizeLocale } from "../translation/translation.service.js";
import { serializePublicContentResponse } from "./content.serializers.js";
import { getPublicContent, listPublishedClients } from "./content.service.js";

export const publicContentRouter = new Hono<AppBindings>();

publicContentRouter.get("/", async (c) => {
  const locale = normalizeLocale(c.req.query("locale"));
  const content = await getPublicContent(locale);
  return c.json(serializePublicContentResponse(content));
});

publicContentRouter.get("/clients", async (c) => {
  const locale = normalizeLocale(c.req.query("locale"));
  const clients = await listPublishedClients(locale);
  return c.json({ clients });
});
