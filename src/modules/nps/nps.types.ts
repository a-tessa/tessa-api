import type { NpsResponseStatus } from "@prisma/client";
import { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  createNpsResponseSchema,
  npsResponseIdParamsSchema,
  npsResponseListQuerySchema,
  updateNpsResponseModerationSchema
} from "./nps.schemas.js";

export type CreateNpsResponseInput = z.infer<typeof createNpsResponseSchema>;
export type NpsResponseListQuery = z.infer<typeof npsResponseListQuerySchema>;
export type NpsResponseIdParams = z.infer<typeof npsResponseIdParamsSchema>;
export type UpdateNpsResponseModerationInput = z.infer<typeof updateNpsResponseModerationSchema>;

export type PublicNpsResponseRecord = {
  id: string;
  authorName: string;
  authorRole: string | null;
  companyName: string | null;
  score: number;
  comment: string;
  question: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type AdminNpsResponseRecord = PublicNpsResponseRecord & {
  status: NpsResponseStatus;
  reviewedById: string | null;
};

export type PublicNpsResponseDto = PublicNpsResponseRecord;
export type AdminNpsResponseDto = AdminNpsResponseRecord;

export type NpsResponseListResult = {
  responses: AdminNpsResponseRecord[];
  pagination: PaginationState;
};

export type PublicNpsResponseListResponseDto = {
  responses: PublicNpsResponseDto[];
};

export type AdminNpsResponseListResponseDto = {
  responses: AdminNpsResponseDto[];
  pagination: PaginationMetaDto;
};

export type PublicNpsResponseResponseDto = {
  response: PublicNpsResponseDto;
};

export type AdminNpsResponseResponseDto = {
  response: AdminNpsResponseDto;
};
