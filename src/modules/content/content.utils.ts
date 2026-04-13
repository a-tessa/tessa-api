import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { collectionConfigs } from "./content.config.js";
import { draftContentSchema } from "./content.schemas.js";
import type { CollectionConfig, DraftContent, StoredCollectionItem } from "./content.types.js";

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
  const publishedContent: Record<string, unknown> = { ...content };

  if (Array.isArray(content.nps)) {
    publishedContent.nps = content.nps.map(({ id, ...item }) => item);
  }

  if (Array.isArray(content.representantsBase)) {
    publishedContent.representantsBase = content.representantsBase.map(({ id, ...item }) => item);
  }

  return publishedContent as Prisma.InputJsonValue;
}

export function toDraftContentInput(content: DraftContent): Prisma.InputJsonValue {
  return content as Prisma.InputJsonValue;
}
