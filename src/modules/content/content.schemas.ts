import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const slugString = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const MAX_OPERATION_SECTION_IMAGES = 20;

export const collectionItemParamsSchema = z.object({
  itemId: nonEmptyString
});

export const servicePageSlugParamsSchema = z.object({
  slug: slugString
});

export const operationSectionImageParamsSchema = z.object({
  imageIndex: z.coerce.number().int().min(0).max(MAX_OPERATION_SECTION_IMAGES - 1)
});

const heroTopicBaseSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  button: z.object({
    text: nonEmptyString,
    url: nonEmptyString
  })
});

export const heroTopicSchema = heroTopicBaseSchema.extend({
  image: nonEmptyString
});

export const heroTopicInputSchema = heroTopicBaseSchema.extend({
  image: nonEmptyString.optional()
});

export const MAX_HERO_SLIDES = 3;

const heroSectionArraySchema = z.array(heroTopicSchema).min(1).max(MAX_HERO_SLIDES);
const heroSectionInputArraySchema = z.array(heroTopicInputSchema).min(1).max(MAX_HERO_SLIDES);

export const heroSectionSlideParamsSchema = z.object({
  slideIndex: z.coerce.number().int().min(0).max(MAX_HERO_SLIDES - 1)
});

export const heroSectionSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return [value];
  }

  return value;
}, heroSectionArraySchema);

export const heroSectionInputSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return [value];
  }

  return value;
}, heroSectionInputArraySchema);

export const sceneryItemSchema = z.object({
  slug: slugString,
  title: nonEmptyString,
  category: nonEmptyString,
  image: nonEmptyString
});

export const scenerySectionSchema = z.array(sceneryItemSchema);

export const operationSectionImageSchema = z.object({
  url: nonEmptyString,
  alt: nonEmptyString.optional()
});

export const operationSectionImageInputSchema = z.object({
  url: nonEmptyString.optional(),
  alt: nonEmptyString.optional()
});

const operationSectionImagesSchema = z
  .array(operationSectionImageSchema)
  .min(1)
  .max(MAX_OPERATION_SECTION_IMAGES);
const operationSectionImagesInputSchema = z
  .array(operationSectionImageInputSchema)
  .min(1)
  .max(MAX_OPERATION_SECTION_IMAGES)
  .optional();

export const operationSectionSchema = z.object({
  images: operationSectionImagesSchema
});

export const operationSectionMultipartInputSchema = z.object({
  images: operationSectionImagesInputSchema
});

export const npsAnswerSchema = z.object({
  text: nonEmptyString,
  value: z.number(),
  imageUrl: nonEmptyString
});

export const npsItemSchema = z.object({
  question: nonEmptyString,
  answers: z.array(npsAnswerSchema)
});

export const servicePageAssetMetaSchema = z.object({
  pathname: nonEmptyString,
  mimeType: nonEmptyString,
  sizeBytes: z.number().int().positive(),
  originalFilename: nonEmptyString
});

export const servicesPageImageSchema = z.object({
  imgUrl: nonEmptyString
});

export const servicesPageImageMutationSchema = z.object({
  imgUrl: nonEmptyString,
  meta: servicePageAssetMetaSchema.optional()
});

export const servicesPageImageInputSchema = z.object({
  imgUrl: nonEmptyString.optional(),
  meta: servicePageAssetMetaSchema.optional()
});

const servicesPageImagesSchema = z.array(servicesPageImageSchema).max(15);
const servicesPageImagesMutationSchema = z.array(servicesPageImageMutationSchema).min(1).max(15);
const servicesPageImagesInputSchema = z.array(servicesPageImageInputSchema).min(1).max(15).optional();

export const servicePageAssetKindSchema = z.enum(["background", "image"]);
export const servicePageAssetIndexSchema = z.coerce.number().int().min(0).max(14);

function normalizeLegacyServicesPage(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (Array.isArray(record.images)) {
    if (
      typeof record.backgroundImageUrl === "string" &&
      record.backgroundImageUrl.trim().length > 0
    ) {
      return value;
    }

    const firstImage = record.images[0];
    const fallbackBackgroundImageUrl =
      typeof firstImage === "object" &&
      firstImage !== null &&
      !Array.isArray(firstImage) &&
      typeof (firstImage as Record<string, unknown>).imgUrl === "string"
        ? (firstImage as Record<string, string>).imgUrl
        : undefined;

    return {
      ...record,
      backgroundImageUrl: fallbackBackgroundImageUrl
    };
  }

  const normalizedImages: Array<{ imgUrl: string }> = [];

  if (typeof record.imageUrl === "string" && record.imageUrl.trim().length > 0) {
    normalizedImages.push({ imgUrl: record.imageUrl });
  }

  if (Array.isArray(record.examples)) {
    for (const example of record.examples) {
      if (typeof example !== "object" || example === null || Array.isArray(example)) {
        continue;
      }

      const exampleRecord = example as Record<string, unknown>;
      const imgUrl = exampleRecord.imgUrl;

      if (typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        normalizedImages.push({ imgUrl });
      }
    }
  }

  return {
    slug: record.slug,
    title: record.title,
    category: record.category,
    subtitle: record.subtitle,
    exampleVideoUrl: record.exampleVideoUrl,
    backgroundImageUrl:
      typeof record.backgroundImageUrl === "string" && record.backgroundImageUrl.trim().length > 0
        ? record.backgroundImageUrl
        : normalizedImages[0]?.imgUrl,
    images: normalizedImages
  };
}

const servicesPageBaseSchema = z.object({
  slug: slugString,
  title: nonEmptyString,
  category: nonEmptyString,
  subtitle: nonEmptyString,
  exampleVideoUrl: nonEmptyString,
  backgroundImageUrl: nonEmptyString
});

const servicesPageMutationBaseSchema = servicesPageBaseSchema.extend({
  backgroundImageMeta: servicePageAssetMetaSchema.optional()
});

export const servicesPageItemSchema = z.preprocess(
  normalizeLegacyServicesPage,
  servicesPageBaseSchema.extend({
    images: servicesPageImagesSchema
  })
);

export const servicesPageMutationSchema = servicesPageMutationBaseSchema.extend({
  images: servicesPageImagesMutationSchema
});

export const servicesPageMultipartInputSchema = servicesPageMutationBaseSchema.extend({
  backgroundImageUrl: nonEmptyString.optional(),
  images: servicesPageImagesInputSchema
});

const representantEmailSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .email("Email inválido.");

const representantStoredFieldsSchema = z.object({
  name: z.string().trim().min(1),
  companyName: z.string().trim().default(""),
  segment: z.string().trim().default(""),
  phone: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().default(""),
  email: z.string().trim().min(1)
});

function normalizeLegacyRepresentant(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    companyName: "",
    segment: "",
    state: "",
    ...record
  };
}

export const representantSchema = z.preprocess(
  normalizeLegacyRepresentant,
  representantStoredFieldsSchema
);

export const representantInputSchema = z.object({
  name: nonEmptyString.max(120),
  companyName: nonEmptyString.max(160),
  segment: nonEmptyString.max(120),
  phone: nonEmptyString.max(40),
  city: nonEmptyString.max(120),
  state: nonEmptyString.max(120),
  email: representantEmailSchema
});

export const categorySchema = z.object({
  name: nonEmptyString,
  slug: slugString
});

export const CLIENT_LOGO_MAX_BYTES = 700 * 1024;

export const clientItemParamsSchema = z.object({
  clientId: nonEmptyString
});

const clientWebsiteSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .url("Website precisa ser uma URL válida.");

export const clientItemSchema = z.object({
  name: nonEmptyString.max(120),
  alt: nonEmptyString.max(255),
  website: clientWebsiteSchema.optional(),
  logoUrl: nonEmptyString
});

export const clientItemInputSchema = z.object({
  name: nonEmptyString.max(120),
  alt: nonEmptyString.max(255),
  website: clientWebsiteSchema.optional(),
  logoUrl: nonEmptyString.optional()
});

export const draftClientItemSchema = clientItemSchema.extend({
  id: nonEmptyString.optional()
});

export const companyInformationSchema = z.object({
  name: nonEmptyString,
  cnpj: nonEmptyString,
  address: nonEmptyString,
  zipCode: nonEmptyString,
  email: nonEmptyString,
  phoneContacts: z.array(
    z.object({
      phone: nonEmptyString
    })
  )
});

export const draftNpsItemSchema = npsItemSchema.extend({
  id: nonEmptyString.optional()
});

export const draftServicesPageItemSchema = servicesPageItemSchema;

export const draftRepresentantSchema = z.preprocess(
  normalizeLegacyRepresentant,
  representantStoredFieldsSchema.extend({
    id: nonEmptyString.optional()
  })
);

export const draftCategorySchema = categorySchema.extend({
  id: nonEmptyString.optional()
});

export const draftContentSchema = z.object({
  heroSection: heroSectionSchema.optional(),
  operationSection: operationSectionSchema.optional(),
  nps: z.array(draftNpsItemSchema).optional(),
  servicesPages: z.array(draftServicesPageItemSchema).optional(),
  representantsBase: z.array(draftRepresentantSchema).optional(),
  categories: z.array(draftCategorySchema).optional(),
  clients: z.array(draftClientItemSchema).optional(),
  companyInformation: companyInformationSchema.optional()
}).passthrough();
