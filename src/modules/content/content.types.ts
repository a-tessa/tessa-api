import type { LandingPage, LandingPageStatus } from "@prisma/client";
import { z, type ZodTypeAny } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  collectionItemParamsSchema,
  companyInformationSchema,
  draftContentSchema,
  draftNpsItemSchema,
  draftRepresentantSchema,
  draftServicesPageItemSchema,
  heroSectionSchema,
  npsItemSchema,
  operationSectionSchema,
  pageListQuerySchema,
  pageUpsertSchema,
  representantSchema,
  scenerySectionSchema,
  servicesPageItemSchema,
  slugParamsSchema
} from "./content.schemas.js";

export type SlugParams = z.infer<typeof slugParamsSchema>;
export type CollectionItemParams = z.infer<typeof collectionItemParamsSchema>;
export type PageListQuery = z.infer<typeof pageListQuerySchema>;
export type PageUpsertInput = z.infer<typeof pageUpsertSchema>;

export type HeroSection = z.infer<typeof heroSectionSchema>;
export type ScenerySection = z.infer<typeof scenerySectionSchema>;
export type OperationSection = z.infer<typeof operationSectionSchema>;
export type NpsItem = z.infer<typeof npsItemSchema>;
export type ServicesPageItem = z.infer<typeof servicesPageItemSchema>;
export type Representant = z.infer<typeof representantSchema>;
export type CompanyInformation = z.infer<typeof companyInformationSchema>;

export type DraftNpsItem = z.infer<typeof draftNpsItemSchema>;
export type DraftServicesPageItem = z.infer<typeof draftServicesPageItemSchema>;
export type DraftRepresentant = z.infer<typeof draftRepresentantSchema>;
export type DraftContent = z.infer<typeof draftContentSchema> & Record<string, unknown>;

export type SingularSectionKey =
  | "heroSection"
  | "scenerySection"
  | "operationSection"
  | "companyInformation";

export type CollectionKey = "nps" | "servicesPages" | "representantsBase";

export type SingularSectionConfig = {
  key: SingularSectionKey;
  path: string;
  label: string;
  schema: ZodTypeAny;
};

export type CollectionConfig = {
  key: CollectionKey;
  path: string;
  label: string;
  schema: ZodTypeAny;
  storedSchema: ZodTypeAny;
};

export type StoredCollectionItem = Record<string, unknown> & {
  id: string;
};

export type PageState = {
  page: LandingPage;
  content: DraftContent;
};

export type PublishedContent = Record<string, unknown>;

export type PublicPageRecord = {
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedContent: PublishedContent;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type AdminPageSummaryRecord = {
  id: string;
  slug: string;
  title: string;
  status: LandingPageStatus;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type AdminPageRecord = Omit<LandingPage, "draftContent" | "publishedContent"> & {
  draftContent: DraftContent;
  publishedContent: PublishedContent | null;
};

export type PublicPageDto = PublicPageRecord;
export type AdminPageSummaryDto = AdminPageSummaryRecord;
export type AdminPageDto = AdminPageRecord;

export type ContentPagesListResult = {
  pages: AdminPageSummaryRecord[];
  pagination: PaginationState;
};

export type ContentPagesListResponseDto = {
  pages: AdminPageSummaryDto[];
  pagination: PaginationMetaDto;
};

export type PublicPageResponseDto = {
  page: PublicPageDto;
};

export type AdminPageResponseDto = {
  page: AdminPageDto;
};

export type SectionResponseDto<K extends SingularSectionKey = SingularSectionKey> = {
  [P in K]: NonNullable<DraftContent[P]>;
};

export type CollectionResponseDto<K extends CollectionKey = CollectionKey> = {
  [P in K]: StoredCollectionItem[];
};

export type CollectionItemResponseDto = {
  item: StoredCollectionItem;
};
