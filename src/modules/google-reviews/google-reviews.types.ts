/** Google Business Profile API v4 host for reviews. */
export const GOOGLE_MYBUSINESS_HOST = "https://mybusiness.googleapis.com/v4";

/** OAuth 2.0 token endpoint used to exchange the refresh token. */
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Max page size accepted by accounts.locations.reviews.list. */
export const GOOGLE_REVIEWS_PAGE_SIZE = 50;

/** Safety cap so a runaway pagination loop can never hang the sync. */
export const GOOGLE_REVIEWS_MAX_PAGES = 40;

export const GOOGLE_FETCH_TIMEOUT_MS = 10_000;

/** Business Profile star ratings arrive as an enum, not a number. */
export const GOOGLE_STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
};

/**
 * A Google review already mapped to the shape our sync needs, decoupled from
 * both the raw API payload and the `Testimonial` table.
 */
export interface NormalizedGoogleReview {
  externalId: string;
  authorName: string;
  authorUrl: string | null;
  profileImageUrl: string | null;
  rating: number;
  comment: string;
  relativeTime: string | null;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
}

/**
 * Source of Google reviews. Swappable so the whole pipeline can run against
 * fixtures while the Business Profile API access request is pending.
 */
export interface GoogleReviewsProvider {
  readonly name: "stub" | "live";
  listAllReviews(): Promise<NormalizedGoogleReview[]>;
}

export type GoogleReviewsMode = "live" | "stub" | "off";

export interface GoogleReviewsSyncResult {
  mode: GoogleReviewsMode | "auto";
  skipped: boolean;
  fetched: number;
  created: number;
  updated: number;
  removed: number;
}
