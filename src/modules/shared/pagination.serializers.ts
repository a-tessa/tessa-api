import type { PaginationMetaDto, PaginationState } from "./pagination.types.js";

export function serializePagination(input: PaginationState): PaginationMetaDto {
  return {
    page: input.page,
    perPage: input.perPage,
    total: input.total,
    totalPages: Math.ceil(input.total / input.perPage)
  };
}
