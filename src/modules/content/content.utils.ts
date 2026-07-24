import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { badRequest } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { collectionConfigs } from "./content.config.js";
import {
  draftContentSchema,
  MAX_OPERATION_ALT_LENGTH,
  MAX_OPERATION_SECTION_IMAGES,
  MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH,
  scenerySectionSchema
} from "./content.schemas.js";
import type {
  Category,
  CollectionConfig,
  ContentWithScenery,
  DraftContent,
  ScenerySection,
  StoredCollectionItem
} from "./content.types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasLegacyHeroSectionFormat(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return isObject(value.heroSection);
}

export function parseDraftContent(value: unknown): DraftContent {
  const rawContent = isObject(value) ? value : {};
  return draftContentSchema.parse(rawContent) as DraftContent;
}

function normalizeComparableValue(value: string) {
  return value.trim().toLowerCase();
}

export function resolveCategorySlugFromCategories(
  categories: Pick<Category, "name" | "slug">[],
  value: string
) {
  const normalizedValue = normalizeComparableValue(value);
  const category = categories.find((currentCategory) => {
    return (
      normalizeComparableValue(currentCategory.slug) === normalizedValue ||
      normalizeComparableValue(currentCategory.name) === normalizedValue
    );
  });

  return category?.slug ?? null;
}

/**
 * Ensures `categorySlug` exists among published landing-page categories.
 * Shared by blog articles, documents, and any other entity that references categories by slug.
 */
export async function validateCategorySlug(categorySlug: string): Promise<void> {
  const page = await prisma.landingPage.findUnique({
    where: { slug: "home" },
    select: { status: true, publishedContent: true }
  });

  if (!page || page.status !== "published" || !page.publishedContent) {
    badRequest("Nenhuma categoria disponível. Publique o conteúdo da landing page primeiro.");
  }

  const content = page.publishedContent as Record<string, unknown>;
  const categories = content.categories as Array<{ slug: string }> | undefined;

  if (!categories?.length) {
    badRequest("Nenhuma categoria cadastrada no conteúdo publicado.");
  }

  const found = categories.some((c) => c.slug === categorySlug);
  if (!found) {
    const available = categories.map((c) => c.slug).join(", ");
    badRequest(`Categoria "${categorySlug}" não encontrada. Disponíveis: ${available}`);
  }
}

export function buildScenerySection(content: DraftContent): ScenerySection {
  const categories = Array.isArray(content.categories) ? content.categories : [];
  const servicesPages = Array.isArray(content.servicesPages) ? content.servicesPages : [];

  return scenerySectionSchema.parse(
    servicesPages
      .filter(
        (servicePage) =>
          servicePage.backgroundImageUrl?.trim() || servicePage.images[0]?.imgUrl
      )
      .map((servicePage) => ({
        slug: servicePage.slug,
        title: servicePage.title,
        category:
          resolveCategorySlugFromCategories(categories, servicePage.category) ??
          servicePage.category,
        image:
          servicePage.backgroundImageUrl?.trim() ||
          servicePage.images[0]!.imgUrl
      }))
  );
}

export function withDerivedScenery<T extends Record<string, unknown>>(
  value: T
): ContentWithScenery<T> {
  const content = parseDraftContent(value);

  return {
    ...content,
    scenerySection: buildScenerySection(content)
  } as ContentWithScenery<T>;
}

export function ensureCollectionIds(
  content: DraftContent,
  config: CollectionConfig
): {
  content: DraftContent;
  changed: boolean;
  items: StoredCollectionItem[];
} {
  const rawItems = content[config.key];

  if (!Array.isArray(rawItems)) {
    return {
      content,
      changed: false,
      items: []
    };
  }

  let changed = false;
  const items = rawItems.map((rawItem) => {
    const parsedItem = config.storedSchema.parse(rawItem);

    if (parsedItem.id) {
      return parsedItem as StoredCollectionItem;
    }

    changed = true;

    return {
      ...parsedItem,
      id: randomUUID()
    } as StoredCollectionItem;
  });

  if (!changed) {
    return {
      content,
      changed: false,
      items
    };
  }

  return {
    content: {
      ...content,
      [config.key]: items
    },
    changed: true,
    items
  };
}

export function ensureAllCollectionIds(content: DraftContent): {
  content: DraftContent;
  changed: boolean;
} {
  let nextContent = content;
  let changed = false;

  for (const config of collectionConfigs) {
    const normalized = ensureCollectionIds(nextContent, config);
    nextContent = normalized.content;
    changed = changed || normalized.changed;
  }

  return {
    content: nextContent,
    changed
  };
}

export function assertOperationSectionReadyForPublish(content: DraftContent): void {
  const section = content.operationSection;
  if (!section) {
    return;
  }

  const imageCount = section.images.length;
  if (
    imageCount < MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH ||
    imageCount > MAX_OPERATION_SECTION_IMAGES
  ) {
    badRequest(
      `A seção de operação precisa ter entre ${MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH} e ${MAX_OPERATION_SECTION_IMAGES} imagens para publicação.`
    );
  }

  for (const [index, image] of section.images.entries()) {
    const alt = typeof image.alt === "string" ? image.alt.trim() : "";
    if (alt.length === 0 || alt.length > MAX_OPERATION_ALT_LENGTH) {
      badRequest(
        `A imagem ${index} da seção de operação precisa de um texto alternativo válido (1 a ${MAX_OPERATION_ALT_LENGTH} caracteres) antes da publicação.`
      );
    }
  }
}

export function sanitizeContentForPublish(value: unknown): Prisma.InputJsonValue {
  const content = parseDraftContent(value);
  const publishedContent: Record<string, unknown> = {
    ...content,
    scenerySection: buildScenerySection(content)
  };

  if (Array.isArray(content.nps)) {
    publishedContent.nps = content.nps.map(({ id, ...item }) => item);
  }

  if (Array.isArray(content.representantsBase)) {
    publishedContent.representantsBase = content.representantsBase.map(({ id, ...item }) => item);
  }

  if (Array.isArray(content.categories)) {
    publishedContent.categories = content.categories.map(({ id, ...item }) => item);
  }

  if (Array.isArray((content as Record<string, unknown>).clients)) {
    const clients = (content as Record<string, unknown>).clients as Array<Record<string, unknown>>;
    publishedContent.clients = clients.map((client) => {
      const { id: _id, ...rest } = client;
      return rest;
    });
  }

  return publishedContent as Prisma.InputJsonValue;
}

export function toDraftContentInput(content: DraftContent): Prisma.InputJsonValue {
  return content as Prisma.InputJsonValue;
}
