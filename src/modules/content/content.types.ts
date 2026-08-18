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
  aboutSectionSchema,
  headingImagesSchema,
  headingImageEntrySchema,
  headingImagePageKeySchema,
  heroSectionInputSchema,
  heroSectionSchema,
  industrySectionSchema,
  instagramSelectionSchema,
  npsItemSchema,
  operationSectionSchema,
  operationSectionWriteSchema,
  operationSectionMutationSchema,
  operationSectionImageParamsSchema,
  operationSectionMultipartInputSchema,
  representantInputSchema,
  representantSchema,
  resultsSectionSchema,
  resultsSectionInputSchema,
  footerSectionSchema,
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
export type IndustrySection = z.infer<typeof industrySectionSchema>;
export type AboutSection = z.infer<typeof aboutSectionSchema>;
export type HeadingImagePageKey = z.infer<typeof headingImagePageKeySchema>;
export type HeadingImageEntry = z.infer<typeof headingImageEntrySchema>;
export type HeadingImages = z.infer<typeof headingImagesSchema>;
export type SceneryItem = z.infer<typeof sceneryItemSchema>;
export type ScenerySection = z.infer<typeof scenerySectionSchema>;
export type OperationSection = z.infer<typeof operationSectionSchema>;
export type OperationSectionWrite = z.infer<typeof operationSectionWriteSchema>;
export type OperationSectionMutationInput = z.infer<typeof operationSectionMutationSchema>;
export type OperationSectionMultipartInput = z.infer<typeof operationSectionMultipartInputSchema>;
export type ResultsSection = z.infer<typeof resultsSectionInputSchema>;
export type StoredResultsSection = z.infer<typeof resultsSectionSchema>;
export type FooterSection = z.infer<typeof footerSectionSchema>;
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
export type InstagramSelection = z.infer<typeof instagramSelectionSchema>;
export type DraftContent = z.infer<typeof draftContentSchema> & Record<string, unknown>;
export type ContentWithScenery<T extends Record<string, unknown>> = T & {
  scenerySection: ScenerySection;
};

export type SingularSectionKey =
  | "heroSection"
  | "industrySection"
  | "aboutSection"
  | "operationSection"
  | "resultsSection"
  | "footerSection"
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

export type HeadingImagesResponseDto = {
  headingImages: HeadingImages;
};
