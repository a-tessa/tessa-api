import { notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateTalentApplicationInput,
  TalentApplicationListQuery,
  TalentApplicationListResult,
  TalentApplicationRecord
} from "./talent-application.types.js";

const talentApplicationSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  educationLevel: true,
  education: true,
  practiceArea: true,
  professionalSummary: true,
  createdAt: true
} as const;

export async function createTalentApplication(
  input: CreateTalentApplicationInput
): Promise<TalentApplicationRecord> {
  return prisma.talentApplication.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      educationLevel: input.educationLevel,
      education: input.education,
      practiceArea: input.practiceArea,
      professionalSummary: input.professionalSummary
    },
    select: talentApplicationSelect
  });
}

export async function listTalentApplications(
  query: TalentApplicationListQuery
): Promise<TalentApplicationListResult> {
  const skip = (query.page - 1) * query.perPage;

  const [talentApplications, total] = await Promise.all([
    prisma.talentApplication.findMany({
      skip,
      take: query.perPage,
      orderBy: { createdAt: "desc" },
      select: talentApplicationSelect
    }),
    prisma.talentApplication.count()
  ]);

  return {
    talentApplications,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function deleteTalentApplication(id: string): Promise<void> {
  const existing = await prisma.talentApplication.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existing) {
    notFound("Cadastro não encontrado.");
  }

  await prisma.talentApplication.delete({ where: { id } });
}
