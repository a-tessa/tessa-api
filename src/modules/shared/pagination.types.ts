export type PaginationState = {
  page: number;
  perPage: number;
  total: number;
};

export type PaginationMetaDto = PaginationState & {
  totalPages: number;
};
