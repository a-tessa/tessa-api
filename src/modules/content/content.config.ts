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
  resultsSectionInputSchema,
  footerSectionSchema,
  pageSeoSchema,
  seoDefaultsSchema,
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
    key: "resultsSection",
    path: "results-section",
    label: "Resultados",
    schema: resultsSectionInputSchema
  },
  {
    key: "footerSection",
    path: "footer-section",
    label: "Rodapé",
    schema: footerSectionSchema
  },
  {
    key: "companyInformation",
    path: "company-information",
    label: "Informações da empresa",
    schema: companyInformationSchema
  },
  {
    key: "seoDefaults",
    path: "seo-defaults",
    label: "Padrões globais de SEO",
    schema: seoDefaultsSchema
  },
  {
    key: "pageSeo",
    path: "page-seo",
    label: "SEO da página",
    schema: pageSeoSchema
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
