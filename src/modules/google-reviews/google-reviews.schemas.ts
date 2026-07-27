import { z } from "zod";

export const googleOAuthTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
  token_type: z.string().optional()
});

const googleReviewerSchema = z.object({
  displayName: z.string().optional(),
  profilePhotoUrl: z.string().url().optional(),
  isAnonymous: z.boolean().optional()
});

export const googleReviewSchema = z.object({
  reviewId: z.string().min(1),
  reviewer: googleReviewerSchema.optional(),
  starRating: z.string().optional(),
  comment: z.string().optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional()
});

export const googleReviewsListResponseSchema = z.object({
  reviews: z.array(googleReviewSchema).optional(),
  averageRating: z.number().optional(),
  totalReviewCount: z.number().optional(),
  nextPageToken: z.string().optional()
});

export type GoogleReviewDto = z.infer<typeof googleReviewSchema>;
