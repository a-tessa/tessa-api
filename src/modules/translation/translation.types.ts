import type { TranslationLocale } from "@prisma/client";

export type TargetLocale = TranslationLocale;

export const TARGET_LOCALES: readonly TargetLocale[] = ["en", "es"] as const;

export type TranslationEntityType = "landingPage" | "blogArticle";

export type TextFormat = "plain" | "html";

/**
 * A single translatable unit. `id` is a stable path-like key that links the
 * source string to its translation (e.g. "hero.0.title", "blog.content").
 */
export interface TranslatableItem {
  id: string;
  text: string;
  format: TextFormat;
}

/** Map of TranslatableItem.id -> translated string. */
export type TranslationMap = Record<string, string>;

export interface GlossaryEntry {
  term: string;
  en: string;
  es: string;
  /** When true, the term must be kept verbatim (brand names, product names). */
  keepAsIs?: boolean;
}
