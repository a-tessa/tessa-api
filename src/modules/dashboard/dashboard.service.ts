import { prisma } from "../../lib/prisma.js";
import type { DashboardStatsRecord } from "./dashboard.types.js";

export async function getDashboardStats(): Promise<DashboardStatsRecord> {
  const [
    pendingContacts,
    totalContacts,
    pendingTestimonials,
    approvedTestimonials,
    ratingAggregate,
    publishedArticles,
    draftArticles,
    documents,
    galleryItems,
    activeUsers,
    instagramConnectionCount
  ] = await Promise.all([
    prisma.contact.count({ where: { hasBeenContacted: false } }),
    prisma.contact.count(),
    prisma.testimonial.count({ where: { status: "pending" } }),
    prisma.testimonial.count({ where: { status: "approved" } }),
    prisma.testimonial.aggregate({
      where: { status: "approved" },
      _avg: { rating: true }
    }),
    prisma.blogArticle.count({ where: { status: "published" } }),
    prisma.blogArticle.count({ where: { status: "draft" } }),
    prisma.document.count(),
    prisma.galleryMediaItem.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.instagramConnection.count()
  ]);

  const averageRating =
    ratingAggregate._avg.rating === null
      ? null
      : Math.round(ratingAggregate._avg.rating * 10) / 10;

  return {
    pendingContacts,
    totalContacts,
    pendingTestimonials,
    approvedTestimonials,
    averageRating,
    publishedArticles,
    draftArticles,
    documents,
    galleryItems,
    activeUsers,
    instagramConnected: instagramConnectionCount > 0
  };
}
