import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { collectionConfigs } from "./content.config.js";
import { draftContentSchema, scenerySectionSchema } from "./content.schemas.js";
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

export function buildScenerySection(content: DraftContent): ScenerySection {
  const categories = Array.isArray(content.categories) ? content.categories : [];
  const servicesPages = Array.isArray(content.servicesPages) ? content.servicesPages : [];

  return scenerySectionSchema.parse(
    servicesPages
      .filter((servicePage) => servicePage.images[0]?.imgUrl)
      .map((servicePage) => ({
        slug: servicePage.slug,
        title: servicePage.title,
        category:
          resolveCategorySlugFromCategories(categories, servicePage.category) ??
          servicePage.category,
        image: servicePage.images[0]!.imgUrl
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

  return publishedContent as Prisma.InputJsonValue;
}

export function toDraftContentInput(content: DraftContent): Prisma.InputJsonValue {
  return content as Prisma.InputJsonValue;
}
