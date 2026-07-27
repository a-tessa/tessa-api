import { z } from "zod";
import { getYouTubeVideoId } from "./content.youtube.js";

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  nonEmptyString.optional()
);
const slugString = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const MAX_OPERATION_SECTION_IMAGES = 40;
export const MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH = 6;
export const MAX_OPERATION_ALT_LENGTH = 100;
export const MAX_OPERATION_CAPTION_LENGTH = 300;

export const collectionItemParamsSchema = z.object({
  itemId: nonEmptyString
});

export const servicePageSlugParamsSchema = z.object({
  slug: slugString
});

export const operationSectionImageParamsSchema = z.object({
  imageIndex: z.coerce.number().int().min(0).max(MAX_OPERATION_SECTION_IMAGES - 1)
});

export const MAX_HERO_SLIDES = 3;
export const MAX_HERO_TITLE_LENGTH = 25;
export const MAX_HERO_DESCRIPTION_LENGTH = 200;

const heroTopicBaseSchema = z.object({
  title: nonEmptyString.max(MAX_HERO_TITLE_LENGTH),
  description: nonEmptyString.max(MAX_HERO_DESCRIPTION_LENGTH),
  button: z.object({
    text: nonEmptyString,
    url: nonEmptyString
  })
});

export const heroTopicSchema = heroTopicBaseSchema.extend({
  image: nonEmptyString
});

export const heroTopicInputSchema = heroTopicBaseSchema.extend({
  image: optionalNonEmptyString
});

const heroTopicStoredBaseSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  button: z.object({
    text: nonEmptyString,
    url: nonEmptyString
  })
});

export const heroTopicUpdateInputSchema = heroTopicStoredBaseSchema.extend({
  image: optionalNonEmptyString
});

export const heroTopicStoredSchema = heroTopicStoredBaseSchema.extend({
  image: nonEmptyString
});

const heroSectionArraySchema = z.array(heroTopicSchema).min(1).max(MAX_HERO_SLIDES);
const heroSectionStoredArraySchema = z.array(heroTopicStoredSchema).min(1).max(MAX_HERO_SLIDES);
const heroSectionInputArraySchema = z.array(heroTopicInputSchema).min(1).max(MAX_HERO_SLIDES);
const heroSectionUpdateInputArraySchema = z
  .array(heroTopicUpdateInputSchema)
  .min(1)
  .max(MAX_HERO_SLIDES);

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

export const heroSectionUpdateInputSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return [value];
  }

  return value;
}, heroSectionUpdateInputArraySchema);

export const heroSectionStoredSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return [value];
  }

  return value;
}, heroSectionStoredArraySchema);

export const sceneryItemSchema = z.object({
  slug: slugString,
  title: nonEmptyString,
  category: nonEmptyString,
  image: nonEmptyString
});

export const scenerySectionSchema = z.array(sceneryItemSchema);

function optionalBoundedString(maximumLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    nonEmptyString.max(maximumLength).optional()
  );
}

const operationAltStoredSchema = optionalBoundedString(MAX_OPERATION_ALT_LENGTH);
const operationCaptionSchema = optionalBoundedString(MAX_OPERATION_CAPTION_LENGTH);

function refineCaptionDiffersFromAlt(
  image: { alt?: string; caption?: string },
  context: z.RefinementCtx
): void {
  if (
    typeof image.alt === "string" &&
    typeof image.caption === "string" &&
    image.alt === image.caption
  ) {
    context.addIssue({
      code: "custom",
      message: "A legenda deve ser diferente do texto alternativo.",
      path: ["caption"]
    });
  }
}

export const servicePageAssetMetaSchema = z.object({
  pathname: nonEmptyString,
  mimeType: nonEmptyString,
  sizeBytes: z.number().int().positive(),
  originalFilename: nonEmptyString
});

/** Stored/draft read shape: legacy items may omit `alt` and `caption`. */
export const operationSectionImageSchema = z
  .object({
    url: nonEmptyString,
    alt: operationAltStoredSchema,
    caption: operationCaptionSchema
  })
  .superRefine(refineCaptionDiffersFromAlt);

/** Write shape for new/changed content: `alt` is required. */
export const operationSectionImageWriteSchema = z
  .object({
    url: nonEmptyString,
    alt: nonEmptyString.max(MAX_OPERATION_ALT_LENGTH),
    caption: operationCaptionSchema
  })
  .superRefine(refineCaptionDiffersFromAlt);

/** Mutation shape accepts optional asset meta from unit uploads (not stored in draft). */
export const operationSectionImageMutationSchema = z
  .object({
    url: nonEmptyString,
    alt: nonEmptyString.max(MAX_OPERATION_ALT_LENGTH),
    caption: operationCaptionSchema,
    meta: servicePageAssetMetaSchema.optional()
  })
  .superRefine(refineCaptionDiffersFromAlt);

export const operationSectionImageInputSchema = z
  .object({
    url: nonEmptyString.optional(),
    alt: nonEmptyString.max(MAX_OPERATION_ALT_LENGTH),
    caption: operationCaptionSchema
  })
  .superRefine(refineCaptionDiffersFromAlt);

const operationSectionImagesSchema = z
  .array(operationSectionImageSchema)
  .max(MAX_OPERATION_SECTION_IMAGES);
const operationSectionImagesWriteSchema = z
  .array(operationSectionImageWriteSchema)
  .max(MAX_OPERATION_SECTION_IMAGES);
const operationSectionImagesMutationSchema = z
  .array(operationSectionImageMutationSchema)
  .max(MAX_OPERATION_SECTION_IMAGES);
const operationSectionImagesInputSchema = z
  .array(operationSectionImageInputSchema)
  .max(MAX_OPERATION_SECTION_IMAGES)
  .optional();

export const operationSectionSchema = z.object({
  images: operationSectionImagesSchema
});

export const operationSectionWriteSchema = z.object({
  images: operationSectionImagesWriteSchema
});

export const operationSectionMutationSchema = z.object({
  images: operationSectionImagesMutationSchema
});

export const operationSectionMultipartInputSchema = z.object({
  images: operationSectionImagesInputSchema
});

export const MAX_INDUSTRY_TITLE_PREFIX_LENGTH = 60;
export const MAX_INDUSTRY_TITLE_LENGTH = 100;
export const MAX_INDUSTRY_SUBTITLE_LENGTH = 700;

export const industryVideoSchema = z.object({
  url: nonEmptyString.refine(
    (url) => getYouTubeVideoId(url) !== null,
    "Informe uma URL válida do YouTube."
  ),
  startSeconds: z.number().int().nonnegative().optional()
});

export const industrySectionSchema = z.object({
  titlePrefix: nonEmptyString.max(MAX_INDUSTRY_TITLE_PREFIX_LENGTH),
  title: nonEmptyString.max(MAX_INDUSTRY_TITLE_LENGTH),
  subtitle: nonEmptyString.max(MAX_INDUSTRY_SUBTITLE_LENGTH),
  videos: z.object({
    "pt-BR": industryVideoSchema,
    en: industryVideoSchema.optional(),
    es: industryVideoSchema.optional()
  })
});

export const MAX_ABOUT_HERO_TITLE_LENGTH = 80;
export const MAX_ABOUT_BODY_LENGTH = 4000;
export const MAX_ABOUT_SIDE_IMAGE_ALT_LENGTH = 120;
export const MAX_ABOUT_PILLAR_TITLE_LENGTH = 80;
export const MAX_ABOUT_PILLAR_DESCRIPTION_LENGTH = 500;

export const aboutPillarSchema = z.object({
  title: nonEmptyString.max(MAX_ABOUT_PILLAR_TITLE_LENGTH),
  description: nonEmptyString.max(MAX_ABOUT_PILLAR_DESCRIPTION_LENGTH)
});

export const aboutSectionSchema = z.object({
  heroTitle: nonEmptyString.max(MAX_ABOUT_HERO_TITLE_LENGTH),
  videos: z.object({
    "pt-BR": industryVideoSchema,
    en: industryVideoSchema.optional(),
    es: industryVideoSchema.optional()
  }),
  sideImage: z.object({
    url: nonEmptyString,
    alt: nonEmptyString.max(MAX_ABOUT_SIDE_IMAGE_ALT_LENGTH)
  }),
  body: nonEmptyString.max(MAX_ABOUT_BODY_LENGTH),
  mission: aboutPillarSchema,
  vision: aboutPillarSchema,
  values: aboutPillarSchema
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

export const instagramSelectionSchema = z
  .object({
    version: z.number().int().nonnegative(),
    primary: nonEmptyString,
    upperRight: nonEmptyString,
    lowerRight: nonEmptyString
  })
  .superRefine((selection, context) => {
    const mediaIds = [
      selection.primary,
      selection.upperRight,
      selection.lowerRight
    ];

    if (new Set(mediaIds).size !== mediaIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As três posições precisam usar publicações distintas."
      });
    }
  });

export const HEADING_IMAGE_PAGE_KEYS = [
  "quem-somos",
  "servicos",
  "representantes",
  "blog",
  "downloads",
  "galeria",
  "contato"
] as const;

export const headingImagePageKeySchema = z.enum(HEADING_IMAGE_PAGE_KEYS);

export const HEADING_IMAGE_PAGE_LABELS = {
  "quem-somos": "Quem Somos",
  servicos: "Serviços",
  representantes: "Representantes",
  blog: "Blog",
  downloads: "Downloads",
  galeria: "Galeria",
  contato: "Contato"
} as const satisfies Record<(typeof HEADING_IMAGE_PAGE_KEYS)[number], string>;

export const headingImageEntrySchema = z.object({
  url: nonEmptyString
});

export const headingImagesSchema = z
  .record(headingImagePageKeySchema, headingImageEntrySchema)
  .default({});

export const headingImagePageParamsSchema = z.object({
  pageKey: headingImagePageKeySchema
});

export const draftContentSchema = z.object({
  heroSection: heroSectionStoredSchema.optional(),
  industrySection: industrySectionSchema.optional(),
  aboutSection: aboutSectionSchema.optional(),
  operationSection: operationSectionSchema.optional(),
  headingImages: headingImagesSchema.optional(),
  nps: z.array(draftNpsItemSchema).optional(),
  servicesPages: z.array(draftServicesPageItemSchema).optional(),
  representantsBase: z.array(draftRepresentantSchema).optional(),
  categories: z.array(draftCategorySchema).optional(),
  clients: z.array(draftClientItemSchema).optional(),
  companyInformation: companyInformationSchema.optional(),
  instagramSelection: instagramSelectionSchema.optional()
}).passthrough();
