import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const slugString = z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const collectionItemParamsSchema = z.object({
  itemId: nonEmptyString
});

export const servicePageSlugParamsSchema = z.object({
  slug: slugString
});

export const heroTopicSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  image: nonEmptyString,
  button: z.object({
    text: nonEmptyString,
    url: nonEmptyString
  })
});

const heroSectionArraySchema = z.array(heroTopicSchema).min(1).max(3);

export const heroSectionSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return [value];
  }

  return value;
}, heroSectionArraySchema);

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
  slug: slugString,
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

export const draftServicesPageItemSchema = servicesPageItemSchema;

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
