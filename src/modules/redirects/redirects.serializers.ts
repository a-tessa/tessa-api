import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  PublicRedirectDto,
  PublicRedirectsResponseDto,
  RedirectDto,
  RedirectListItem,
  RedirectListResponseDto,
  RedirectListResult,
  RedirectRecord,
  RedirectResponseDto
} from "./redirects.types.js";

export function serializeRedirect(
  record: RedirectRecord | RedirectListItem
): RedirectDto {
  return {
    id: record.id,
    fromPath: record.fromPath,
    toPath: record.toPath,
    statusCode: record.statusCode,
    source: record.source,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    destinationMissing: "destinationMissing" in record ? record.destinationMissing : false,
    sourceOccupied: "sourceOccupied" in record ? record.sourceOccupied : false
  };
}

export function serializePublicRedirect(record: RedirectRecord): PublicRedirectDto {
  return {
    fromPath: record.fromPath,
    toPath: record.toPath,
    statusCode: record.statusCode
  };
}

export function serializeRedirectResponse(record: RedirectRecord): RedirectResponseDto {
  return { redirect: serializeRedirect(record) };
}

export function serializeRedirectListResponse(
  result: RedirectListResult
): RedirectListResponseDto {
  return {
    redirects: result.redirects.map(serializeRedirect),
    pagination: serializePagination(result.pagination)
  };
}

export function serializePublicRedirectsResponse(
  redirects: RedirectRecord[]
): PublicRedirectsResponseDto {
  return { redirects: redirects.map(serializePublicRedirect) };
}
