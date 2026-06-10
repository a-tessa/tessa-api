import type { GlossaryEntry, TranslationEntityType } from "./translation.types.js";

export const LANDING_ENTITY_TYPE: TranslationEntityType = "landingPage";
export const BLOG_ENTITY_TYPE: TranslationEntityType = "blogArticle";

/** Max processing attempts before a translation row is left as `failed`. */
export const MAX_TRANSLATION_ATTEMPTS = 4;

/** How many translatable strings go into a single OpenAI request. */
export const PLAIN_BATCH_SIZE = 40;

/** How many translation rows the worker claims per run. */
export const WORKER_BATCH_SIZE = 10;

/**
 * Short description of the business domain, injected into the system prompt so
 * the model uses the correct industry terminology when translating.
 */
export const TRANSLATION_DOMAIN =
  "estruturas metálicas e construção em aço (galpões, carports, aviários, estruturas para creches, telhados, perfis especiais)";

/**
 * Glossary that enforces technically-correct, consistent terminology.
 * - `keepAsIs: true` => the term must NOT be translated (brand/product names).
 * - otherwise => use exactly the provided `en` / `es` rendering.
 *
 * This is a starter list — review and extend it with the team's preferred terms.
 */
export const TRANSLATION_GLOSSARY: GlossaryEntry[] = [
  { term: "Tessa", en: "Tessa", es: "Tessa", keepAsIs: true },
  { term: "estruturas metálicas", en: "steel structures", es: "estructuras metálicas" },
  { term: "estrutura metálica", en: "steel structure", es: "estructura metálica" },
  { term: "construção em aço", en: "steel construction", es: "construcción en acero" },
  { term: "galpão", en: "industrial shed", es: "galpón" },
  { term: "galpões", en: "industrial sheds", es: "galpones" },
  { term: "carport", en: "carport", es: "carport" },
  { term: "aviário", en: "poultry house", es: "galpón avícola" },
  { term: "estrutura de aviário", en: "poultry house structure", es: "estructura de galpón avícola" },
  { term: "estruturas para creches", en: "structures for daycare centers", es: "estructuras para guarderías" },
  { term: "telhado", en: "roof", es: "techo" },
  { term: "perfis especiais", en: "special profiles", es: "perfiles especiales" },
  { term: "representante", en: "sales representative", es: "representante" },
  { term: "orçamento", en: "quote", es: "presupuesto" }
];
