import type { LandingPageStatus } from "@prisma/client";
import { z, type ZodTypeAny } from "zod";
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
  representantSchema,
  servicePageSlugParamsSchema,
  scenerySectionSchema,
  servicesPageItemSchema
} from "./content.schemas.js";

export type CollectionItemParams = z.infer<typeof collectionItemParamsSchema>;
export type ServicePageSlugParams = z.infer<typeof servicePageSlugParamsSchema>;

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

export type CollectionKey = "nps" | "representantsBase";

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

export type PublishedContent = Record<string, unknown>;

export type PublicContentRecord = {
  content: PublishedContent;
  publishedAt: Date | null;
  updatedAt: Date | null;
};

export type AdminContentRecord = {
  status: LandingPageStatus;
  content: DraftContent;
  publishedContent: PublishedContent | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
};

export type PublicContentDto = PublicContentRecord;
export type AdminContentDto = AdminContentRecord;

export type PublicContentResponseDto = {
  content: PublicContentDto["content"];
  publishedAt: Date | null;
  updatedAt: Date | null;
};

export type AdminContentResponseDto = {
  content: AdminContentDto["content"];
  publishedContent: AdminContentDto["publishedContent"];
  status: AdminContentDto["status"];
  publishedAt: Date | null;
  updatedAt: Date | null;
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

export type ServicePageResponseDto = {
  item: DraftServicesPageItem;
};

export type ServicePagesResponseDto = {
  servicesPages: DraftServicesPageItem[];
};
