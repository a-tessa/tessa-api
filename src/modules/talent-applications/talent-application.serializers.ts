import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  TalentApplicationDto,
  TalentApplicationListResponseDto,
  TalentApplicationListResult,
  TalentApplicationRecord,
  TalentApplicationResponseDto
} from "./talent-application.types.js";

export function serializeTalentApplication(
  application: TalentApplicationRecord
): TalentApplicationDto {
  return {
    id: application.id,
    fullName: application.fullName,
    email: application.email,
    phone: application.phone,
    educationLevel: application.educationLevel,
    education: application.education,
    practiceArea: application.practiceArea,
    professionalSummary: application.professionalSummary,
    createdAt: application.createdAt
  };
}

export function serializeTalentApplicationListResponse(
  input: TalentApplicationListResult
): TalentApplicationListResponseDto {
  return {
    talentApplications: input.talentApplications.map(serializeTalentApplication),
    pagination: serializePagination(input.pagination)
  };
}

export function serializeTalentApplicationResponse(
  application: TalentApplicationRecord
): TalentApplicationResponseDto {
  return {
    talentApplication: serializeTalentApplication(application)
  };
}
