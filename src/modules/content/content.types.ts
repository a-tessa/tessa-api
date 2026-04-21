import type { LandingPageStatus } from "@prisma/client";
import { z, type ZodTypeAny } from "zod";
import {
  categorySchema,
  clientItemInputSchema,
  clientItemParamsSchema,
  clientItemSchema,
  collectionItemParamsSchema,
  companyInformationSchema,
  draftCategorySchema,
  draftClientItemSchema,
  draftContentSchema,
  draftNpsItemSchema,
  draftRepresentantSchema,
  draftServicesPageItemSchema,
  heroSectionInputSchema,
  heroSectionSchema,
  npsItemSchema,
  operationSectionSchema,
  operationSectionImageParamsSchema,
  operationSectionMultipartInputSchema,
  representantInputSchema,
  representantSchema,
  servicePageSlugParamsSchema,
  sceneryItemSchema,
  scenerySectionSchema,
  servicesPageItemSchema,
  servicesPageMultipartInputSchema,
  servicesPageMutationSchema
} from "./content.schemas.js";

export type CollectionItemParams = z.infer<typeof collectionItemParamsSchema>;
export type ServicePageSlugParams = z.infer<typeof servicePageSlugParamsSchema>;
export type OperationSectionImageParams = z.infer<typeof operationSectionImageParamsSchema>;
export type ClientItemParams = z.infer<typeof clientItemParamsSchema>;

export type HeroSection = z.infer<typeof heroSectionSchema>;
export type HeroSectionInput = z.infer<typeof heroSectionInputSchema>;
export type SceneryItem = z.infer<typeof sceneryItemSchema>;
export type ScenerySection = z.infer<typeof scenerySectionSchema>;
export type OperationSection = z.infer<typeof operationSectionSchema>;
export type OperationSectionMultipartInput = z.infer<typeof operationSectionMultipartInputSchema>;
export type NpsItem = z.infer<typeof npsItemSchema>;
export type ServicesPageItem = z.infer<typeof servicesPageItemSchema>;
export type ServicesPageMutationInput = z.infer<typeof servicesPageMutationSchema>;
export type ServicePageMultipartInput = z.infer<typeof servicesPageMultipartInputSchema>;
export type Representant = z.infer<typeof representantSchema>;
export type RepresentantInput = z.infer<typeof representantInputSchema>;
export type Category = z.infer<typeof categorySchema>;
export type ClientItem = z.infer<typeof clientItemSchema>;
export type ClientItemInput = z.infer<typeof clientItemInputSchema>;
export type DraftClientItem = z.infer<typeof draftClientItemSchema>;
export type CompanyInformation = z.infer<typeof companyInformationSchema>;

export type DraftNpsItem = z.infer<typeof draftNpsItemSchema>;
export type DraftServicesPageItem = z.infer<typeof draftServicesPageItemSchema>;
export type DraftRepresentant = z.infer<typeof draftRepresentantSchema>;
export type DraftCategory = z.infer<typeof draftCategorySchema>;
export type DraftContent = z.infer<typeof draftContentSchema> & Record<string, unknown>;
export type ContentWithScenery<T extends Record<string, unknown>> = T & {
  scenerySection: ScenerySection;
};

export type SingularSectionKey =
  | "heroSection"
  | "operationSection"
  | "companyInformation";

export type CollectionKey = "nps" | "representantsBase" | "categories";

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
  content: ContentWithScenery<PublishedContent>;
  publishedAt: Date | null;
  updatedAt: Date | null;
};

export type AdminContentRecord = {
  status: LandingPageStatus;
  content: ContentWithScenery<DraftContent>;
  publishedContent: ContentWithScenery<PublishedContent> | null;
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

export type ScenerySectionResponseDto = {
  scenerySection: ScenerySection;
};

export type ServicePageResponseDto = {
  item: DraftServicesPageItem;
};

export type ServicePagesResponseDto = {
  servicesPages: DraftServicesPageItem[];
};
