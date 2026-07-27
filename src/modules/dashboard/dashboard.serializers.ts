import type {
  DashboardStatsDto,
  DashboardStatsRecord,
  DashboardStatsResponseDto
} from "./dashboard.types.js";

export function serializeDashboardStats(
  stats: DashboardStatsRecord
): DashboardStatsDto {
  return {
    pendingContacts: stats.pendingContacts,
    totalContacts: stats.totalContacts,
    pendingTestimonials: stats.pendingTestimonials,
    approvedTestimonials: stats.approvedTestimonials,
    averageRating: stats.averageRating,
    publishedArticles: stats.publishedArticles,
    draftArticles: stats.draftArticles,
    documents: stats.documents,
    galleryItems: stats.galleryItems,
    activeUsers: stats.activeUsers,
    instagramConnected: stats.instagramConnected
  };
}

export function serializeDashboardStatsResponse(
  stats: DashboardStatsRecord
): DashboardStatsResponseDto {
  return {
    stats: serializeDashboardStats(stats)
  };
}
