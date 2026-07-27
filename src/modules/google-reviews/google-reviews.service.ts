import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import {
  isGoogleReviewsLiveConfigured,
  liveGoogleReviewsProvider
} from "./google-reviews.client.js";
import { stubGoogleReviewsProvider } from "./google-reviews.stub.js";
import type {
  GoogleReviewsMode,
  GoogleReviewsProvider,
  GoogleReviewsSyncResult,
  NormalizedGoogleReview
} from "./google-reviews.types.js";

/**
 * Resolves the effective mode. In "auto", live wins when credentials exist;
 * otherwise the stub runs only outside production so fixtures never leak into
 * the live database.
 */
export function resolveGoogleReviewsMode(): GoogleReviewsMode {
  switch (env.GOOGLE_REVIEWS_MODE) {
    case "live":
      return "live";
    case "stub":
      return "stub";
    case "off":
      return "off";
    default:
      if (isGoogleReviewsLiveConfigured()) return "live";
      if (process.env.NODE_ENV !== "production") return "stub";
      return "off";
  }
}

function getProvider(mode: Exclude<GoogleReviewsMode, "off">): GoogleReviewsProvider {
  return mode === "live" ? liveGoogleReviewsProvider : stubGoogleReviewsProvider;
}

async function upsertReview(
  review: NormalizedGoogleReview,
  now: Date
): Promise<"created" | "updated"> {
  const existing = await prisma.testimonial.findUnique({
    where: { externalId: review.externalId },
    select: { id: true }
  });

  const shared = {
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    profileImageUrl: review.profileImageUrl,
    authorUrl: review.authorUrl,
    relativeTime: review.relativeTime,
    sourceCreatedAt: review.sourceCreatedAt,
    sourceUpdatedAt: review.sourceUpdatedAt,
    syncedAt: now,
    // A review re-appearing after removal on Google is restored. `hidden` is
    // deliberately left untouched so admin spam decisions survive syncs.
    removedAt: null,
    status: "approved" as const,
    source: "google" as const
  };

  await prisma.testimonial.upsert({
    where: { externalId: review.externalId },
    create: { ...shared, externalId: review.externalId, reviewedAt: now },
    update: shared
  });

  return existing ? "updated" : "created";
}

/**
 * Full reconciliation sync: upserts every Google review by `externalId` and
 * soft-removes any Google review the API no longer returns, keeping the site
 * and the aggregate honest.
 */
export async function syncGoogleReviews(): Promise<GoogleReviewsSyncResult> {
  const mode = resolveGoogleReviewsMode();

  if (mode === "off") {
    return { mode, skipped: true, fetched: 0, created: 0, updated: 0, removed: 0 };
  }

  const provider = getProvider(mode);
  const reviews = await provider.listAllReviews();
  const now = new Date();

  let created = 0;
  let updated = 0;
  const seenExternalIds: string[] = [];

  for (const review of reviews) {
    seenExternalIds.push(review.externalId);
    const outcome = await upsertReview(review, now);
    if (outcome === "created") created += 1;
    else updated += 1;
  }

  const removal = await prisma.testimonial.updateMany({
    where: {
      source: "google",
      removedAt: null,
      externalId: { notIn: seenExternalIds }
    },
    data: { removedAt: now }
  });

  return {
    mode,
    skipped: false,
    fetched: reviews.length,
    created,
    updated,
    removed: removal.count
  };
}
