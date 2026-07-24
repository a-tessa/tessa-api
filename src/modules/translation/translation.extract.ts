import { buildScenerySection } from "../content/content.utils.js";
import type { DraftContent } from "../content/content.types.js";
import type { BlogArticleRecord } from "../blog/blog.types.js";
import type { DocumentRecord } from "../documents/documents.types.js";
import type { GalleryMediaItemRecord } from "../gallery/gallery.types.js";
import type { InstagramMediaRecord } from "../instagram/instagram.types.js";
import type { TextFormat, TranslatableItem, TranslationMap } from "./translation.types.js";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObjectArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolver invoked for every translatable string in the landing content.
 * Returns the value to write back (the original for extraction, the translation
 * for application). Centralizing the traversal keeps extract/apply ids in sync.
 */
type Resolver = (id: string, text: string, format: TextFormat) => string;

function walkLanding(content: Json, resolve: Resolver): Json {
  const clone = structuredClone(content);

  for (const [index, topic] of asObjectArray(clone.heroSection).entries()) {
    if (nonEmpty(topic.title)) {
      topic.title = resolve(`hero.${index}.title`, topic.title, "plain");
    }
    if (nonEmpty(topic.description)) {
      topic.description = resolve(`hero.${index}.description`, topic.description, "plain");
    }
    const button = topic.button;
    if (isObject(button) && nonEmpty(button.text)) {
      button.text = resolve(`hero.${index}.button.text`, button.text, "plain");
    }
  }

  if (isObject(clone.industrySection)) {
    const industry = clone.industrySection;
    if (nonEmpty(industry.titlePrefix)) {
      industry.titlePrefix = resolve("industry.titlePrefix", industry.titlePrefix, "plain");
    }
    if (nonEmpty(industry.title)) {
      industry.title = resolve("industry.title", industry.title, "plain");
    }
    if (nonEmpty(industry.subtitle)) {
      industry.subtitle = resolve("industry.subtitle", industry.subtitle, "plain");
    }
    // `industry.videos` (URLs and start seconds) is intentionally left untouched: it
    // must never be sent to translation.
  }

  if (isObject(clone.operationSection)) {
    for (const [index, image] of asObjectArray(clone.operationSection.images).entries()) {
      if (nonEmpty(image.alt)) {
        image.alt = resolve(`operation.image.${index}.alt`, image.alt, "plain");
      }
      if (nonEmpty(image.caption)) {
        image.caption = resolve(
          `operation.image.${index}.caption`,
          image.caption,
          "plain"
        );
      }
    }
  }

  for (const [index, item] of asObjectArray(clone.nps).entries()) {
    if (nonEmpty(item.question)) {
      item.question = resolve(`nps.${index}.question`, item.question, "plain");
    }
    for (const [answerIndex, answer] of asObjectArray(item.answers).entries()) {
      if (nonEmpty(answer.text)) {
        answer.text = resolve(`nps.${index}.answer.${answerIndex}.text`, answer.text, "plain");
      }
    }
  }

  for (const page of asObjectArray(clone.servicesPages)) {
    if (!nonEmpty(page.slug)) {
      continue;
    }
    if (nonEmpty(page.title)) {
      page.title = resolve(`service.${page.slug}.title`, page.title, "plain");
    }
    if (nonEmpty(page.subtitle)) {
      page.subtitle = resolve(`service.${page.slug}.subtitle`, page.subtitle, "plain");
    }
  }

  for (const category of asObjectArray(clone.categories)) {
    if (nonEmpty(category.slug) && nonEmpty(category.name)) {
      category.name = resolve(`category.${category.slug}.name`, category.name, "plain");
    }
  }

  for (const [index, client] of asObjectArray(clone.clients).entries()) {
    if (nonEmpty(client.alt)) {
      client.alt = resolve(`client.${index}.alt`, client.alt, "plain");
    }
  }

  return clone;
}

export function extractLandingItems(content: unknown): TranslatableItem[] {
  if (!isObject(content)) {
    return [];
  }

  const items: TranslatableItem[] = [];
  walkLanding(content, (id, text, format) => {
    items.push({ id, text, format });
    return text;
  });

  return items;
}

export function applyLandingItems(content: unknown, map: TranslationMap): Record<string, unknown> {
  if (!isObject(content)) {
    return {};
  }

  const localized = walkLanding(content, (id, text) => map[id] ?? text);

  try {
    localized.scenerySection = buildScenerySection(localized as unknown as DraftContent);
  } catch {
    // Keep the previously stored scenery if rebuilding from localized data fails.
  }

  return localized;
}

type BlogTranslatable = Pick<BlogArticleRecord, "title" | "content" | "headerImageAlt">;

export function extractBlogItems(article: BlogTranslatable): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  if (nonEmpty(article.title)) {
    items.push({ id: "blog.title", text: article.title, format: "plain" });
  }
  if (nonEmpty(article.content)) {
    items.push({ id: "blog.content", text: article.content, format: "html" });
  }
  if (nonEmpty(article.headerImageAlt)) {
    items.push({ id: "blog.headerImageAlt", text: article.headerImageAlt, format: "plain" });
  }

  return items;
}

export function applyBlogItems<T extends BlogTranslatable>(article: T, map: TranslationMap): T {
  return {
    ...article,
    title: map["blog.title"] ?? article.title,
    content: map["blog.content"] ?? article.content,
    headerImageAlt: article.headerImageAlt
      ? map["blog.headerImageAlt"] ?? article.headerImageAlt
      : article.headerImageAlt
  };
}

type DocumentTranslatable = Pick<DocumentRecord, "title" | "description">;

export function extractDocumentItems(document: DocumentTranslatable): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  if (nonEmpty(document.title)) {
    items.push({ id: "document.title", text: document.title, format: "plain" });
  }
  if (nonEmpty(document.description)) {
    items.push({
      id: "document.description",
      text: document.description,
      format: "plain"
    });
  }

  return items;
}

export function applyDocumentItems<T extends DocumentTranslatable>(
  document: T,
  map: TranslationMap
): T {
  return {
    ...document,
    title: map["document.title"] ?? document.title,
    description: document.description
      ? map["document.description"] ?? document.description
      : document.description
  };
}

type InstagramTranslatable = Pick<InstagramMediaRecord, "caption" | "altText">;

export function extractInstagramItems(post: InstagramTranslatable): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  if (nonEmpty(post.caption)) {
    items.push({ id: "instagram.caption", text: post.caption, format: "plain" });
  }
  if (nonEmpty(post.altText)) {
    items.push({ id: "instagram.altText", text: post.altText, format: "plain" });
  }

  return items;
}

export function applyInstagramItems<T extends InstagramTranslatable>(
  post: T,
  map: TranslationMap
): T {
  return {
    ...post,
    caption: post.caption ? map["instagram.caption"] ?? post.caption : post.caption,
    altText: post.altText ? map["instagram.altText"] ?? post.altText : post.altText
  };
}

type GalleryMediaTranslatable = Pick<GalleryMediaItemRecord, "alt" | "caption">;

export function extractGalleryMediaItems(
  item: GalleryMediaTranslatable
): TranslatableItem[] {
  const items: TranslatableItem[] = [];

  if (nonEmpty(item.alt)) {
    items.push({ id: "gallery.alt", text: item.alt, format: "plain" });
  }
  if (nonEmpty(item.caption)) {
    items.push({ id: "gallery.caption", text: item.caption, format: "plain" });
  }

  return items;
}

export function applyGalleryMediaItems<T extends GalleryMediaTranslatable>(
  item: T,
  map: TranslationMap
): T {
  return {
    ...item,
    alt: map["gallery.alt"] ?? item.alt,
    caption: item.caption ? map["gallery.caption"] ?? item.caption : item.caption
  };
}
