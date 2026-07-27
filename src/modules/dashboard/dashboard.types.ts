export type DashboardStatsRecord = {
  pendingContacts: number;
  totalContacts: number;
  pendingTestimonials: number;
  approvedTestimonials: number;
  averageRating: number | null;
  publishedArticles: number;
  draftArticles: number;
  documents: number;
  galleryItems: number;
  activeUsers: number;
  instagramConnected: boolean;
};

export type DashboardStatsDto = DashboardStatsRecord;

export type DashboardStatsResponseDto = {
  stats: DashboardStatsDto;
};
