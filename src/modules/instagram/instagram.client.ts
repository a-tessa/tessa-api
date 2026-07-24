import { env } from "../../env.js";
import { badRequest, internalServerError } from "../../lib/http.js";
import {
  facebookPagesSchema,
  instagramLongLivedTokenSchema,
  instagramMeSchema,
  instagramMediaSchema,
  instagramMediaListSchema,
  type InstagramMediaDto
} from "./instagram.schemas.js";
import {
  INSTAGRAM_API_VERSION,
  INSTAGRAM_GRAPH_HOST,
  INSTAGRAM_META_FETCH_TIMEOUT_MS,
  INSTAGRAM_OAUTH_AUTHORIZE_URL,
  INSTAGRAM_OAUTH_TOKEN_URL,
  INSTAGRAM_REQUIRED_SCOPE,
  INSTAGRAM_SYNC_MEDIA_LIMIT
} from "./instagram.types.js";

const MEDIA_FIELDS = [
  "id",
  "caption",
  "alt_text",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
  "children{media_url,media_type,thumbnail_url}"
].join(",");

function ensureInstagramConfigured(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} {
  if (!env.INSTAGRAM_APP_ID || !env.INSTAGRAM_APP_SECRET || !env.INSTAGRAM_REDIRECT_URI) {
    internalServerError("Integração do Instagram não configurada.");
  }

  return {
    appId: env.INSTAGRAM_APP_ID,
    appSecret: env.INSTAGRAM_APP_SECRET,
    redirectUri: env.INSTAGRAM_REDIRECT_URI
  };
}

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INSTAGRAM_META_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && payload.error?.message
          ? payload.error.message
          : `Falha na API do Instagram (${String(response.status)}).`;
      badRequest(message);
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      badRequest("Timeout ao consultar a API do Instagram.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildInstagramAuthorizeUrl(state: string): string {
  const { appId, redirectUri } = ensureInstagramConfigured();
  const url = new URL(INSTAGRAM_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("display", "page");
  url.searchParams.set(
    "extras",
    JSON.stringify({ setup: { channel: "IG_API_ONBOARDING" } })
  );
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", INSTAGRAM_REQUIRED_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { appId, appSecret } = ensureInstagramConfigured();
  const url = new URL(INSTAGRAM_OAUTH_TOKEN_URL);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const payload = await fetchJson(url.toString());
  const parsed = instagramLongLivedTokenSchema.parse(payload);

  return {
    accessToken: parsed.access_token,
    expiresIn: parsed.expires_in
  };
}

export async function fetchFacebookPages(accessToken: string): Promise<
  Array<{
    id: string;
    name: string;
    instagramUserId: string;
  }>
> {
  const url = new URL(
    `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/me/accounts`
  );
  url.searchParams.set(
    "fields",
    "id,name,instagram_business_account"
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);

  const payload = await fetchJson(url.toString());
  const parsed = facebookPagesSchema.parse(payload);

  return parsed.data.flatMap((page) =>
    page.instagram_business_account
      ? [{
          id: page.id,
          name: page.name,
          instagramUserId: page.instagram_business_account.id
        }]
      : []
  );
}

export async function fetchInstagramMe(
  instagramUserId: string,
  accessToken: string
): Promise<{
  userId: string;
  username: string;
  accountType: string | null;
}> {
  const url = new URL(
    `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/${instagramUserId}`
  );
  url.searchParams.set("fields", "id,username,account_type");
  url.searchParams.set("access_token", accessToken);

  const payload = await fetchJson(url.toString());
  const parsed = instagramMeSchema.parse(payload);

  return {
    userId: parsed.id,
    username: parsed.username,
    accountType: parsed.account_type ?? null
  };
}

export async function fetchRecentMedia(
  instagramUserId: string,
  accessToken: string,
  limit = INSTAGRAM_SYNC_MEDIA_LIMIT
): Promise<InstagramMediaDto[]> {
  const url = new URL(
    `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/${instagramUserId}/media`
  );
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", accessToken);

  const payload = await fetchJson(url.toString());
  return instagramMediaListSchema.parse(payload).data;
}

export async function fetchCollaborativeMedia(
  instagramUserId: string,
  accessToken: string,
  limit = INSTAGRAM_SYNC_MEDIA_LIMIT
): Promise<InstagramMediaDto[]> {
  const url = new URL(
    `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/${instagramUserId}/collaborative_media`
  );
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", accessToken);

  const payload = await fetchJson(url.toString());
  return instagramMediaListSchema.parse(payload).data;
}

export async function fetchMediaById(
  instagramMediaId: string,
  accessToken: string
): Promise<InstagramMediaDto> {
  const url = new URL(
    `${INSTAGRAM_GRAPH_HOST}/${INSTAGRAM_API_VERSION}/${instagramMediaId}`
  );
  url.searchParams.set("fields", MEDIA_FIELDS);
  url.searchParams.set("access_token", accessToken);

  const payload = await fetchJson(url.toString());
  return instagramMediaSchema.parse(payload);
}

export function isInstagramIntegrationConfigured(): boolean {
  return Boolean(
    env.INSTAGRAM_APP_ID &&
      env.INSTAGRAM_APP_SECRET &&
      env.INSTAGRAM_REDIRECT_URI &&
      env.INSTAGRAM_TOKEN_ENCRYPTION_KEY
  );
}
