import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { notFound } from "../../lib/http.js";
import type {
  AdminNpsResponseRecord,
  CreateNpsResponseInput,
  NpsResponseListQuery,
  NpsResponseListResult,
  PublicNpsResponseRecord,
  UpdateNpsResponseModerationInput
} from "./nps.types.js";

const publicNpsResponseSelect = {
  id: true,
  authorName: true,
  authorRole: true,
  companyName: true,
  score: true,
  comment: true,
  question: true,
  createdAt: true,
  reviewedAt: true
} satisfies Prisma.NpsResponseSelect;

const adminNpsResponseSelect = {
  ...publicNpsResponseSelect,
  status: true,
  reviewedById: true
} satisfies Prisma.NpsResponseSelect;

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function createNpsResponse(
  input: CreateNpsResponseInput
): Promise<AdminNpsResponseRecord> {
  return prisma.npsResponse.create({
    data: {
      authorName: input.authorName.trim(),
      authorRole: normalizeOptionalText(input.authorRole),
      companyName: normalizeOptionalText(input.companyName),
      score: input.score,
      comment: input.comment.trim(),
      question: normalizeOptionalText(input.question)
    },
    select: adminNpsResponseSelect
  });
}

export async function listApprovedNpsResponses(): Promise<PublicNpsResponseRecord[]> {
  return prisma.npsResponse.findMany({
    where: {
      status: "approved"
    },
    orderBy: [
      { reviewedAt: "desc" },
      { createdAt: "desc" }
    ],
    select: publicNpsResponseSelect
  });
}

export async function listNpsResponses(
  query: NpsResponseListQuery
): Promise<NpsResponseListResult> {
  const skip = (query.page - 1) * query.perPage;
  const where: Prisma.NpsResponseWhereInput = query.status
    ? { status: query.status }
    : {};

  const [responses, total] = await Promise.all([
    prisma.npsResponse.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ],
      select: adminNpsResponseSelect
    }),
    prisma.npsResponse.count({ where })
  ]);

  return {
    responses,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function getNpsResponseById(id: string): Promise<AdminNpsResponseRecord> {
  const response = await prisma.npsResponse.findUnique({
    where: { id },
    select: adminNpsResponseSelect
  });

  if (!response) {
    notFound("Resposta de NPS não encontrada.");
  }

  return response;
}

export async function updateNpsResponseModeration(
  id: string,
  input: UpdateNpsResponseModerationInput,
  userId: string
): Promise<AdminNpsResponseRecord> {
  const existingResponse = await prisma.npsResponse.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existingResponse) {
    notFound("Resposta de NPS não encontrada.");
  }

  return prisma.npsResponse.update({
    where: { id },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedById: userId
    },
    select: adminNpsResponseSelect
  });
}

export async function deleteNpsResponse(id: string): Promise<void> {
  const response = await prisma.npsResponse.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!response) {
    notFound("Resposta de NPS não encontrada.");
  }

  await prisma.npsResponse.delete({
    where: { id }
  });
}
