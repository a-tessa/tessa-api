import type { DocumentLocale } from "@prisma/client";
import type { ContentLocale, TargetLocale } from "../translation/translation.types.js";
import { SOURCE_LOCALE } from "../translation/translation.types.js";

export function toDocumentLocale(locale: ContentLocale): DocumentLocale {
  if (locale === "pt-BR") {
    return "pt_BR";
  }

  return locale;
}

export function toContentLocale(locale: DocumentLocale): ContentLocale {
  if (locale === "pt_BR") {
    return SOURCE_LOCALE;
  }

  return locale;
}

export function resolveDocumentDbLocale(
  locale: TargetLocale | null
): DocumentLocale {
  if (!locale) {
    return "pt_BR";
  }

  return locale;
}
