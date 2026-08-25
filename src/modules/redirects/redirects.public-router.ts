import { Hono } from "hono";
import type { AppBindings } from "../../types.js";
import { serializePublicRedirectsResponse } from "./redirects.serializers.js";
import { listPublicRedirects } from "./redirects.service.js";

export const publicRedirectsRouter = new Hono<AppBindings>();

publicRedirectsRouter.get("/", async (c) => {
  const redirects = await listPublicRedirects();
  return c.json(serializePublicRedirectsResponse(redirects));
});
