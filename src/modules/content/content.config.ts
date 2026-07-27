import {
  aboutSectionSchema,
  categorySchema,
  companyInformationSchema,
  draftCategorySchema,
  draftNpsItemSchema,
  draftRepresentantSchema,
  heroSectionSchema,
  industrySectionSchema,
  npsItemSchema,
  operationSectionSchema,
  representantInputSchema,
  servicesPageItemSchema
} from "./content.schemas.js";
import type { CollectionConfig, SingularSectionConfig } from "./content.types.js";

export const singularSectionConfigs = [
  {
    key: "heroSection",
    path: "hero-section",
    label: "Seção hero",
    schema: heroSectionSchema
  },
  {
    key: "industrySection",
    path: "industry-section",
    label: "Seção Indústria",
    schema: industrySectionSchema
  },
  {
    key: "aboutSection",
    path: "about-section",
    label: "Quem Somos",
    schema: aboutSectionSchema
  },
  {
    key: "operationSection",
    path: "operation-section",
    label: "Seção de operação",
    schema: operationSectionSchema
  },
  {
    key: "companyInformation",
    path: "company-information",
    label: "Informações da empresa",
    schema: companyInformationSchema
  }
] satisfies readonly SingularSectionConfig[];

export const collectionConfigs = [
  {
    key: "nps",
    path: "nps",
    label: "Pergunta de NPS",
    schema: npsItemSchema,
    storedSchema: draftNpsItemSchema
  },
  {
    key: "representantsBase",
    path: "representants-base",
    label: "Representante",
    schema: representantInputSchema,
    storedSchema: draftRepresentantSchema
  },
  {
    key: "categories",
    path: "categories",
    label: "Categoria",
    schema: categorySchema,
    storedSchema: draftCategorySchema
  }
] satisfies readonly CollectionConfig[];

export const servicesPagesConfig = {
  key: "servicesPages",
  path: "services-pages",
  label: "Página de serviço",
  schema: servicesPageItemSchema
} as const;
