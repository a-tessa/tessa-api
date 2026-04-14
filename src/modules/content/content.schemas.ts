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

const heroSectionArraySchema = z.array(heroTopicSchema).min(1).max(3);
const heroSectionInputArraySchema = z.array(heroTopicInputSchema).min(1).max(3);

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

export const servicesPageImageSchema = z.object({
  imgUrl: nonEmptyString
});

export const servicesPageImageInputSchema = z.object({
  imgUrl: nonEmptyString.optional()
});

const servicesPageImagesSchema = z.array(servicesPageImageSchema).max(15);
const servicesPageImagesMutationSchema = servicesPageImagesSchema.min(1);
const servicesPageImagesInputSchema = z.array(servicesPageImageInputSchema).min(1).max(15).optional();

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
      if (
        typeof example === "object" &&
        example !== null &&
        !Array.isArray(example) &&
        typeof (example as Record<string, unknown>).imgUrl === "string" &&
        (example as Record<string, unknown>).imgUrl!.trim().length > 0
      ) {
        normalizedImages.push({
          imgUrl: (example as Record<string, string>).imgUrl
        });
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

export const servicesPageItemSchema = z.preprocess(
  normalizeLegacyServicesPage,
  servicesPageBaseSchema.extend({
    images: servicesPageImagesSchema
  })
);

export const servicesPageMutationSchema = servicesPageBaseSchema.extend({
  images: servicesPageImagesMutationSchema
});

export const servicesPageMultipartInputSchema = servicesPageBaseSchema.extend({
  backgroundImageUrl: nonEmptyString.optional(),
  images: servicesPageImagesInputSchema
});

export const representantSchema = z.object({
  name: nonEmptyString,
  phone: nonEmptyString,
  email: nonEmptyString,
  city: nonEmptyString,
  state: nonEmptyString
});

export const categorySchema = z.object({
  name: nonEmptyString,
  slug: slugString
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

export const draftRepresentantSchema = representantSchema.extend({
  id: nonEmptyString.optional()
});

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
  companyInformation: companyInformationSchema.optional()
}).passthrough();
