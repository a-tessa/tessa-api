import type { TestimonialStatus } from "@prisma/client";
import { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  createTestimonialSchema,
  testimonialIdParamsSchema,
  testimonialListQuerySchema,
  updateTestimonialModerationSchema
} from "./testimonial.schemas.js";

export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type TestimonialListQuery = z.infer<typeof testimonialListQuerySchema>;
export type TestimonialIdParams = z.infer<typeof testimonialIdParamsSchema>;
export type UpdateTestimonialModerationInput = z.infer<
  typeof updateTestimonialModerationSchema
>;

export type PublicTestimonialRecord = {
  id: string;
  authorName: string;
  authorRole: string | null;
  companyName: string | null;
  rating: number;
  comment: string;
  question: string | null;
  profileImageUrl: string | null;
  reviewImageUrl: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type AdminTestimonialRecord = PublicTestimonialRecord & {
  status: TestimonialStatus;
  profileImagePathname: string | null;
  reviewImagePathname: string | null;
  reviewedById: string | null;
};

export type PublicTestimonialDto = PublicTestimonialRecord;
export type AdminTestimonialDto = AdminTestimonialRecord;

export type TestimonialListResult = {
  testimonials: AdminTestimonialRecord[];
  pagination: PaginationState;
};

export type TestimonialStatsRecord = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type PublicTestimonialListResponseDto = {
  testimonials: PublicTestimonialDto[];
};

export type AdminTestimonialListResponseDto = {
  testimonials: AdminTestimonialDto[];
  pagination: PaginationMetaDto;
};

export type PublicTestimonialResponseDto = {
  testimonial: PublicTestimonialDto;
};

export type AdminTestimonialResponseDto = {
  testimonial: AdminTestimonialDto;
};

export type TestimonialStatsResponseDto = {
  stats: TestimonialStatsRecord;
};

export type PreparedTestimonialImage = {
  url: string;
  pathname: string;
};
