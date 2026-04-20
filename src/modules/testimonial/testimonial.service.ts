import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/http.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import { buildTestimonialImagePath } from "../assets/assets.utils.js";
import type {
  AdminTestimonialRecord,
  CreateTestimonialInput,
  PreparedTestimonialImage,
  PublicTestimonialRecord,
  TestimonialListQuery,
  TestimonialListResult,
  TestimonialStatsRecord,
  UpdateTestimonialModerationInput
} from "./testimonial.types.js";

const publicTestimonialSelect = {
  id: true,
  authorName: true,
  authorRole: true,
  companyName: true,
  rating: true,
  comment: true,
  question: true,
  profileImageUrl: true,
  reviewImageUrl: true,
  createdAt: true,
  reviewedAt: true
} satisfies Prisma.TestimonialSelect;

const adminTestimonialSelect = {
  ...publicTestimonialSelect,
  status: true,
  profileImagePathname: true,
  reviewImagePathname: true,
  reviewedById: true
} satisfies Prisma.TestimonialSelect;

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function uploadTestimonialImage(
  file: File,
  kind: "profile" | "review"
): Promise<PreparedTestimonialImage> {
  const prepared = await prepareImageAsset(file);
  const pathname = buildTestimonialImagePath(kind, prepared.originalFilename);
  const blob = await uploadPublicAsset(pathname, prepared);

  return { url: blob.url, pathname };
}

async function cleanupUploadedImages(images: PreparedTestimonialImage[]) {
  await Promise.all(
    images.map((image) => deleteBlobAsset(image.url).catch(() => {}))
  );
}

export async function createTestimonial(
  input: CreateTestimonialInput,
  images: { profileImage?: File | null; reviewImage?: File | null } = {}
): Promise<AdminTestimonialRecord> {
  const uploaded: PreparedTestimonialImage[] = [];
  let profile: PreparedTestimonialImage | null = null;
  let review: PreparedTestimonialImage | null = null;

  try {
    if (images.profileImage) {
      profile = await uploadTestimonialImage(images.profileImage, "profile");
      uploaded.push(profile);
    }

    if (images.reviewImage) {
      review = await uploadTestimonialImage(images.reviewImage, "review");
      uploaded.push(review);
    }

    return await prisma.testimonial.create({
      data: {
        authorName: input.authorName.trim(),
        authorRole: normalizeOptionalText(input.authorRole),
        companyName: normalizeOptionalText(input.companyName),
        rating: input.rating,
        comment: input.comment.trim(),
        question: normalizeOptionalText(input.question),
        profileImageUrl: profile?.url ?? null,
        profileImagePathname: profile?.pathname ?? null,
        reviewImageUrl: review?.url ?? null,
        reviewImagePathname: review?.pathname ?? null
      },
      select: adminTestimonialSelect
    });
  } catch (error) {
    await cleanupUploadedImages(uploaded);
    throw error;
  }
}

export async function listApprovedTestimonials(): Promise<PublicTestimonialRecord[]> {
  return prisma.testimonial.findMany({
    where: { status: "approved" },
    orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
    select: publicTestimonialSelect
  });
}

export async function listTestimonials(
  query: TestimonialListQuery
): Promise<TestimonialListResult> {
  const skip = (query.page - 1) * query.perPage;
  const where: Prisma.TestimonialWhereInput = query.status
    ? { status: query.status }
    : {};

  const [testimonials, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: adminTestimonialSelect
    }),
    prisma.testimonial.count({ where })
  ]);

  return {
    testimonials,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function getTestimonialById(id: string): Promise<AdminTestimonialRecord> {
  const testimonial = await prisma.testimonial.findUnique({
    where: { id },
    select: adminTestimonialSelect
  });

  if (!testimonial) {
    notFound("Depoimento não encontrado.");
  }

  return testimonial;
}

export async function getTestimonialStats(): Promise<TestimonialStatsRecord> {
  const grouped = await prisma.testimonial.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  const stats: TestimonialStatsRecord = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  };

  for (const row of grouped) {
    const count = row._count._all;
    stats.total += count;
    stats[row.status] = count;
  }

  return stats;
}

export async function updateTestimonialModeration(
  id: string,
  input: UpdateTestimonialModerationInput,
  userId: string
): Promise<AdminTestimonialRecord> {
  const existing = await prisma.testimonial.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existing) {
    notFound("Depoimento não encontrado.");
  }

  return prisma.testimonial.update({
    where: { id },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedById: userId
    },
    select: adminTestimonialSelect
  });
}

export async function deleteTestimonial(id: string): Promise<void> {
  const testimonial = await prisma.testimonial.findUnique({
    where: { id },
    select: {
      id: true,
      profileImageUrl: true,
      reviewImageUrl: true
    }
  });

  if (!testimonial) {
    notFound("Depoimento não encontrado.");
  }

  await prisma.testimonial.delete({ where: { id } });

  const blobUrls = [testimonial.profileImageUrl, testimonial.reviewImageUrl].filter(
    (url): url is string => Boolean(url)
  );

  await Promise.all(
    blobUrls.map((url) => deleteBlobAsset(url).catch(() => {}))
  );
}
