import { Hono } from "hono";

export const healthRouter = new Hono();

healthRouter.get("/", (c) =>
  c.json({
    ok: true,
    service: "tessa-api",
    timestamp: new Date().toISOString()
  })
);
