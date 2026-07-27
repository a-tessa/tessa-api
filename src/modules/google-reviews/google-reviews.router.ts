import { Hono, type Context } from "hono";
import { env } from "../../env.js";
import { syncGoogleReviews } from "./google-reviews.service.js";

export const googleReviewsInternalRouter = new Hono();

function isAuthorized(c: Context): boolean {
  const secrets = [env.TRANSLATION_WORKER_SECRET, env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  if (secrets.length === 0) {
    return false;
  }

  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const provided = bearer ?? c.req.header("x-cron-secret") ?? null;

  return provided !== null && secrets.includes(provided);
}

async function handleSync(c: Context) {
  if (!isAuthorized(c)) {
    return c.json({ error: "Não autorizado." }, 401);
  }

  const result = await syncGoogleReviews();
  return c.json({ ok: true, ...result });
}

googleReviewsInternalRouter.get("/sync", handleSync);
googleReviewsInternalRouter.post("/sync", handleSync);
