import {
  companyInformationSchema,
  draftNpsItemSchema,
  draftRepresentantSchema,
  heroSectionSchema,
  npsItemSchema,
  operationSectionSchema,
  representantSchema,
  scenerySectionSchema,
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
    key: "scenerySection",
    path: "scenery-section",
    label: "Seção de cenário",
    schema: scenerySectionSchema
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
    schema: representantSchema,
    storedSchema: draftRepresentantSchema
  }
] satisfies readonly CollectionConfig[];

export const servicesPagesConfig = {
  key: "servicesPages",
  path: "services-pages",
  label: "Página de serviço",
  schema: servicesPageItemSchema
} as const;
