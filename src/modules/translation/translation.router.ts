import { Hono, type Context } from "hono";
import { env } from "../../env.js";
import { WORKER_BATCH_SIZE } from "./translation.config.js";
import { runPendingTranslations } from "./translation.service.js";

export const translationRouter = new Hono();

function isAuthorized(c: Context): boolean {
  const secrets = [env.TRANSLATION_WORKER_SECRET, env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  if (secrets.length === 0) {
    return false;
  }

  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const provided = bearer ?? c.req.header("x-translation-secret") ?? null;

  return provided !== null && secrets.includes(provided);
}

function parseLimit(raw: string | undefined): number {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return WORKER_BATCH_SIZE;
  }

  return Math.min(Math.trunc(parsed), 50);
}

async function handleRun(c: Context) {
  if (!isAuthorized(c)) {
    return c.json({ error: "Não autorizado." }, 401);
  }

  const limit = parseLimit(c.req.query("limit"));
  const result = await runPendingTranslations(limit);

  return c.json({ ok: true, ...result });
}

translationRouter.get("/run", handleRun);
translationRouter.post("/run", handleRun);
