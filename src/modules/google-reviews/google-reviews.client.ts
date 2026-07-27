import { env } from "../../env.js";
import { badRequest, internalServerError } from "../../lib/http.js";
import {
  googleOAuthTokenSchema,
  googleReviewsListResponseSchema,
  type GoogleReviewDto
} from "./google-reviews.schemas.js";
import {
  GOOGLE_FETCH_TIMEOUT_MS,
  GOOGLE_MYBUSINESS_HOST,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_REVIEWS_MAX_PAGES,
  GOOGLE_REVIEWS_PAGE_SIZE,
  GOOGLE_STAR_RATING_MAP,
  type GoogleReviewsProvider,
  type NormalizedGoogleReview
} from "./google-reviews.types.js";

interface LiveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
  locationId: string;
}

export function isGoogleReviewsLiveConfigured(): boolean {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REFRESH_TOKEN &&
      env.GOOGLE_BUSINESS_ACCOUNT_ID &&
      env.GOOGLE_BUSINESS_LOCATION_ID
  );
}

function ensureLiveConfig(): LiveConfig {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    !env.GOOGLE_BUSINESS_ACCOUNT_ID ||
    !env.GOOGLE_BUSINESS_LOCATION_ID
  ) {
    internalServerError("Integração de avaliações do Google não configurada.");
  }

  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN,
    accountId: env.GOOGLE_BUSINESS_ACCOUNT_ID,
    locationId: env.GOOGLE_BUSINESS_LOCATION_ID
  };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      badRequest("Timeout ao consultar a API do Google Business Profile.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(config: LiveConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetchWithTimeout(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error_description" in payload
        ? String((payload as { error_description?: unknown }).error_description)
        : `Falha ao renovar o token do Google (${String(response.status)}).`;
    badRequest(message);
  }

  return googleOAuthTokenSchema.parse(payload).access_token;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeReview(review: GoogleReviewDto): NormalizedGoogleReview {
  return {
    externalId: review.reviewId,
    authorName: review.reviewer?.displayName?.trim() || "Usuário do Google",
    authorUrl: null,
    profileImageUrl: review.reviewer?.profilePhotoUrl ?? null,
    rating: review.starRating ? (GOOGLE_STAR_RATING_MAP[review.starRating] ?? 0) : 0,
    comment: review.comment?.trim() ?? "",
    relativeTime: null,
    sourceCreatedAt: parseDate(review.createTime),
    sourceUpdatedAt: parseDate(review.updateTime)
  };
}

async function fetchReviewsPage(
  config: LiveConfig,
  accessToken: string,
  pageToken: string | null
): Promise<{ reviews: GoogleReviewDto[]; nextPageToken: string | null }> {
  const url = new URL(
    `${GOOGLE_MYBUSINESS_HOST}/accounts/${config.accountId}/locations/${config.locationId}/reviews`
  );
  url.searchParams.set("pageSize", String(GOOGLE_REVIEWS_PAGE_SIZE));
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : `Falha na API do Google Business Profile (${String(response.status)}).`;
    badRequest(message);
  }

  const parsed = googleReviewsListResponseSchema.parse(payload);
  return {
    reviews: parsed.reviews ?? [],
    nextPageToken: parsed.nextPageToken ?? null
  };
}

export const liveGoogleReviewsProvider: GoogleReviewsProvider = {
  name: "live",
  async listAllReviews(): Promise<NormalizedGoogleReview[]> {
    const config = ensureLiveConfig();
    const accessToken = await getAccessToken(config);

    const collected: NormalizedGoogleReview[] = [];
    let pageToken: string | null = null;
    let page = 0;

    do {
      const { reviews, nextPageToken } = await fetchReviewsPage(
        config,
        accessToken,
        pageToken
      );
      for (const review of reviews) {
        collected.push(normalizeReview(review));
      }
      pageToken = nextPageToken;
      page += 1;
    } while (pageToken && page < GOOGLE_REVIEWS_MAX_PAGES);

    return collected;
  }
};
