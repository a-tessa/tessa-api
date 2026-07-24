import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { env } from "../../env.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import {
  localizeInstagramMediaList,
  normalizeLocale
} from "../translation/translation.service.js";
import { isInstagramIntegrationConfigured } from "./instagram.client.js";
import {
  instagramOAuthCompleteSchema,
  instagramPublicListQuerySchema,
  instagramSelectionInputSchema
} from "./instagram.schemas.js";
import {
  serializeInstagramConnectionStatus,
  serializeInstagramCuratorCatalog,
  serializeInstagramMediaResponse,
  serializeInstagramSyncResponse
} from "./instagram.serializers.js";
import {
  completeInstagramOAuth,
  disconnectInstagram,
  getInstagramCuratorCatalog,
  getInstagramConnectionStatus,
  listPublishedInstagramMedia,
  saveInstagramSelectionDraft,
  startInstagramOAuth,
  syncInstagramMedia
} from "./instagram.service.js";

export const instagramRouter = new Hono<AppBindings>();

function isInternalAuthorized(c: Context): boolean {
  const secrets = [env.TRANSLATION_WORKER_SECRET, env.CRON_SECRET].filter(
    (value): value is string => Boolean(value)
  );

  if (secrets.length === 0) {
    return false;
  }

  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const provided = bearer ?? c.req.header("x-cron-secret") ?? null;

  return provided !== null && secrets.includes(provided);
}

function buildOAuthCallbackHtml(): string {
  const adminUrl = new URL(
    "/conteudo/instagram",
    env.ADMIN_APP_URL ?? "http://localhost:5174"
  ).toString();

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Conectando Instagram</title>
  </head>
  <body>
    <main><p id="status">Concluindo a conexão com o Instagram…</p></main>
    <script>
      (async () => {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const query = new URLSearchParams(window.location.search);
        const adminUrl = ${JSON.stringify(adminUrl)};
        const error = fragment.get("error_description") || fragment.get("error") ||
          query.get("error_description") || query.get("error");

        if (error) {
          const redirect = new URL(adminUrl);
          redirect.searchParams.set("error", error);
          window.location.replace(redirect.toString());
          return;
        }

        try {
          const response = await fetch("/api/instagram/oauth/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: fragment.get("state") || query.get("state"),
              accessToken: fragment.get("access_token") || undefined,
              longLivedToken: fragment.get("long_lived_token") || undefined,
              expiresIn: fragment.get("expires_in") || undefined,
              dataAccessExpirationTime:
                fragment.get("data_access_expiration_time") || undefined
            })
          });
          const payload = await response.json();
          if (!response.ok || !payload.redirectUrl) {
            throw new Error(payload.error || "Não foi possível concluir a conexão.");
          }
          window.location.replace(payload.redirectUrl);
        } catch (caught) {
          const redirect = new URL(adminUrl);
          redirect.searchParams.set(
            "error",
            caught instanceof Error ? caught.message : "Falha inesperada na conexão."
          );
          window.location.replace(redirect.toString());
        }
      })();
    </script>
  </body>
</html>`;
}

instagramRouter.get(
  "/",
  zValidator("query", instagramPublicListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const locale = normalizeLocale(query.locale);
    const media = await listPublishedInstagramMedia(query.limit);
    const localized = await localizeInstagramMediaList(media, locale);
    const fallbackCaption =
      locale === "en"
        ? "See this Tessa post on Instagram."
        : locale === "es"
          ? "Mira esta publicación de Tessa en Instagram."
          : "Confira esta publicação da Tessa no Instagram.";

    return c.json(
      serializeInstagramMediaResponse(
        localized.map((item) => ({
          ...item,
          caption: item.caption ?? fallbackCaption
        }))
      )
    );
  }
);

instagramRouter.get("/admin/status", requireAuth, requireRole(["MASTER", "ADMIN"]), async (c) => {
  const { connection, media } = await getInstagramConnectionStatus();
  return c.json({
    configured: isInstagramIntegrationConfigured(),
    enabled: env.INSTAGRAM_CONTENT_ENABLED,
    ...serializeInstagramConnectionStatus(connection, media)
  });
});

instagramRouter.get(
  "/admin/catalog",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const catalog = await getInstagramCuratorCatalog();
    return c.json(serializeInstagramCuratorCatalog(catalog));
  }
);

instagramRouter.put(
  "/admin/selection",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("json", instagramSelectionInputSchema),
  async (c) => {
    const user = c.get("user");
    const catalog = await saveInstagramSelectionDraft(
      c.req.valid("json"),
      user.id
    );
    return c.json(serializeInstagramCuratorCatalog(catalog));
  }
);

instagramRouter.get(
  "/admin/oauth/start",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const user = c.get("user");
    const { authorizeUrl } = await startInstagramOAuth(user.id);
    return c.json({ authorizeUrl });
  }
);

instagramRouter.get("/oauth/callback", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.html(buildOAuthCallbackHtml());
});

instagramRouter.post(
  "/oauth/complete",
  zValidator("json", instagramOAuthCompleteSchema),
  async (c) => {
    const redirectUrl = await completeInstagramOAuth(c.req.valid("json"));
    return c.json({ redirectUrl });
  }
);

instagramRouter.post(
  "/admin/sync",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const result = await syncInstagramMedia();
    return c.json(serializeInstagramSyncResponse(result));
  }
);

instagramRouter.delete(
  "/admin/connection",
  requireAuth,
  requireRole(["MASTER"]),
  async (c) => {
    await disconnectInstagram();
    return c.json({ message: "Conta do Instagram desconectada." });
  }
);

export const instagramInternalRouter = new Hono();

async function handleInternalSync(c: Context) {
  if (!isInternalAuthorized(c)) {
    return c.json({ error: "Não autorizado." }, 401);
  }

  const result = await syncInstagramMedia();
  return c.json(serializeInstagramSyncResponse(result));
}

instagramInternalRouter.get("/sync", handleInternalSync);
instagramInternalRouter.post("/sync", handleInternalSync);
