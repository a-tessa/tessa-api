import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const slugParamsSchema = z.object({
  slug: nonEmptyString
});

export const collectionItemParamsSchema = slugParamsSchema.extend({
  itemId: nonEmptyString
});

export const pageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const heroSectionSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  image: nonEmptyString,
  button: z.object({
    text: nonEmptyString,
    url: nonEmptyString
  })
});

export const scenerySectionSchema = z.object({
  title: nonEmptyString,
  image: nonEmptyString
});

export const operationSectionSchema = z.object({
  images: z.array(
    z.object({
      url: nonEmptyString,
      alt: nonEmptyString
    })
  )
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

export const servicesPageExampleSchema = z.object({
  imgUrl: nonEmptyString
});

export const servicesPageItemSchema = z.object({
  title: nonEmptyString,
  category: nonEmptyString,
  subtitle: nonEmptyString,
  imageUrl: nonEmptyString,
  exampleVideoUrl: nonEmptyString,
  examples: z.array(servicesPageExampleSchema)
});

export const representantSchema = z.object({
  name: nonEmptyString,
  phone: nonEmptyString,
  email: nonEmptyString,
  city: nonEmptyString,
  state: nonEmptyString
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

export const draftServicesPageItemSchema = servicesPageItemSchema.extend({
  id: nonEmptyString.optional()
});

export const draftRepresentantSchema = representantSchema.extend({
  id: nonEmptyString.optional()
});

export const draftContentSchema = z.object({
  heroSection: heroSectionSchema.optional(),
  scenerySection: scenerySectionSchema.optional(),
  operationSection: operationSectionSchema.optional(),
  nps: z.array(draftNpsItemSchema).optional(),
  servicesPages: z.array(draftServicesPageItemSchema).optional(),
  representantsBase: z.array(draftRepresentantSchema).optional(),
  companyInformation: companyInformationSchema.optional()
}).passthrough();

export const pageUpsertSchema = z.object({
  title: z.string().min(2),
  seoTitle: z.string().min(2).max(80).optional().nullable(),
  seoDescription: z.string().min(2).max(160).optional().nullable(),
  draftContent: draftContentSchema
});
