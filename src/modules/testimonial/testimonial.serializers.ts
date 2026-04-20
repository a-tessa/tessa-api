import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  AdminTestimonialDto,
  AdminTestimonialListResponseDto,
  AdminTestimonialRecord,
  AdminTestimonialResponseDto,
  PublicTestimonialDto,
  PublicTestimonialListResponseDto,
  PublicTestimonialRecord,
  PublicTestimonialResponseDto,
  TestimonialListResult,
  TestimonialStatsRecord,
  TestimonialStatsResponseDto
} from "./testimonial.types.js";

export function serializePublicTestimonial(
  testimonial: PublicTestimonialRecord
): PublicTestimonialDto {
  return {
    id: testimonial.id,
    authorName: testimonial.authorName,
    authorRole: testimonial.authorRole,
    companyName: testimonial.companyName,
    rating: testimonial.rating,
    comment: testimonial.comment,
    question: testimonial.question,
    profileImageUrl: testimonial.profileImageUrl,
    reviewImageUrl: testimonial.reviewImageUrl,
    createdAt: testimonial.createdAt,
    reviewedAt: testimonial.reviewedAt
  };
}

export function serializeAdminTestimonial(
  testimonial: AdminTestimonialRecord
): AdminTestimonialDto {
  return {
    ...serializePublicTestimonial(testimonial),
    status: testimonial.status,
    profileImagePathname: testimonial.profileImagePathname,
    reviewImagePathname: testimonial.reviewImagePathname,
    reviewedById: testimonial.reviewedById
  };
}

export function serializePublicTestimonialListResponse(
  testimonials: PublicTestimonialRecord[]
): PublicTestimonialListResponseDto {
  return {
    testimonials: testimonials.map(serializePublicTestimonial)
  };
}

export function serializeAdminTestimonialListResponse(
  input: TestimonialListResult
): AdminTestimonialListResponseDto {
  return {
    testimonials: input.testimonials.map(serializeAdminTestimonial),
    pagination: serializePagination(input.pagination)
  };
}

export function serializePublicTestimonialResponse(
  testimonial: PublicTestimonialRecord
): PublicTestimonialResponseDto {
  return {
    testimonial: serializePublicTestimonial(testimonial)
  };
}

export function serializeAdminTestimonialResponse(
  testimonial: AdminTestimonialRecord
): AdminTestimonialResponseDto {
  return {
    testimonial: serializeAdminTestimonial(testimonial)
  };
}

export function serializeTestimonialStatsResponse(
  stats: TestimonialStatsRecord
): TestimonialStatsResponseDto {
  return { stats };
}
