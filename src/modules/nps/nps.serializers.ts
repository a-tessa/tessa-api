import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  AdminNpsResponseDto,
  AdminNpsResponseListResponseDto,
  AdminNpsResponseRecord,
  AdminNpsResponseResponseDto,
  NpsResponseListResult,
  PublicNpsResponseDto,
  PublicNpsResponseListResponseDto,
  PublicNpsResponseRecord,
  PublicNpsResponseResponseDto
} from "./nps.types.js";

export function serializePublicNpsResponse(
  response: PublicNpsResponseRecord
): PublicNpsResponseDto {
  return {
    id: response.id,
    authorName: response.authorName,
    authorRole: response.authorRole,
    companyName: response.companyName,
    score: response.score,
    comment: response.comment,
    question: response.question,
    createdAt: response.createdAt,
    reviewedAt: response.reviewedAt
  };
}

export function serializeAdminNpsResponse(
  response: AdminNpsResponseRecord
): AdminNpsResponseDto {
  return {
    ...serializePublicNpsResponse(response),
    status: response.status,
    reviewedById: response.reviewedById
  };
}

export function serializePublicNpsResponseListResponse(
  responses: PublicNpsResponseRecord[]
): PublicNpsResponseListResponseDto {
  return {
    responses: responses.map(serializePublicNpsResponse)
  };
}

export function serializeAdminNpsResponseListResponse(
  input: NpsResponseListResult
): AdminNpsResponseListResponseDto {
  return {
    responses: input.responses.map(serializeAdminNpsResponse),
    pagination: serializePagination(input.pagination)
  };
}

export function serializePublicNpsResponseResponse(
  response: PublicNpsResponseRecord
): PublicNpsResponseResponseDto {
  return {
    response: serializePublicNpsResponse(response)
  };
}

export function serializeAdminNpsResponseResponse(
  response: AdminNpsResponseRecord
): AdminNpsResponseResponseDto {
  return {
    response: serializeAdminNpsResponse(response)
  };
}
