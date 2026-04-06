import { Hono } from "hono";
import type { AppBindings } from "../../types.js";
import { adminContentRouter } from "./content.admin-router.js";
import { publicContentRouter } from "./content.public-router.js";

export const contentRouter = new Hono<AppBindings>();

contentRouter.route("/public", publicContentRouter);
contentRouter.route("/admin", adminContentRouter);
