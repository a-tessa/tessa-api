import type { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import type {
  createTalentApplicationSchema,
  talentApplicationListQuerySchema
} from "./talent-application.schemas.js";

export type CreateTalentApplicationInput = z.infer<typeof createTalentApplicationSchema>;

export type TalentApplicationRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  educationLevel: string;
  education: string;
  practiceArea: string;
  professionalSummary: string;
  createdAt: Date;
};

export type TalentApplicationDto = TalentApplicationRecord;

export type TalentApplicationResponseDto = {
  talentApplication: TalentApplicationDto;
};

export type TalentApplicationListQuery = z.infer<typeof talentApplicationListQuerySchema>;

export type TalentApplicationListResult = {
  talentApplications: TalentApplicationRecord[];
  pagination: PaginationState;
};

export type TalentApplicationListResponseDto = {
  talentApplications: TalentApplicationDto[];
  pagination: PaginationMetaDto;
};
