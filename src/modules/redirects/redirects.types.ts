import type { Redirect, RedirectSource } from "@prisma/client";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";

export type RedirectRecord = Redirect;
export type { RedirectSource };

export type CreateRedirectInput = {
  fromPath: string;
  toPath: string;
  statusCode?: 301 | 302;
  source?: RedirectSource;
  entityType?: string | null;
  entityId?: string | null;
};

export type UpdateRedirectInput = {
  fromPath?: string;
  toPath?: string;
  statusCode?: 301 | 302;
};

export type RedirectListQuery = {
  page: number;
  perPage: number;
  q?: string;
};

export type RedirectDto = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  source: RedirectSource;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
  destinationMissing: boolean;
  sourceOccupied: boolean;
};

export type RedirectListItem = RedirectRecord & {
  destinationMissing: boolean;
  sourceOccupied: boolean;
};

export type PublicRedirectDto = {
  fromPath: string;
  toPath: string;
  statusCode: number;
};

export type RedirectListResult = {
  redirects: RedirectListItem[];
  pagination: PaginationState;
};

export type RedirectResponseDto = {
  redirect: RedirectDto;
};

export type RedirectListResponseDto = {
  redirects: RedirectDto[];
  pagination: PaginationMetaDto;
};

export type PublicRedirectsResponseDto = {
  redirects: PublicRedirectDto[];
};
