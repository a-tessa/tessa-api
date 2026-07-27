import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import { serializeDashboardStatsResponse } from "./dashboard.serializers.js";
import { getDashboardStats } from "./dashboard.service.js";

export const dashboardRouter = new Hono<AppBindings>();

dashboardRouter.use("/admin", requireAuth, requireRole(["MASTER", "ADMIN"]));
dashboardRouter.use("/admin/*", requireAuth, requireRole(["MASTER", "ADMIN"]));

dashboardRouter.get("/admin/stats", async (c) => {
  const stats = await getDashboardStats();

  return c.json(serializeDashboardStatsResponse(stats));
});
