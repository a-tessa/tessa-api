import { createHash } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import type { Translation } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isTranslationConfigured } from "../../lib/ai.js";
import { env } from "../../env.js";
import type { BlogArticleRecord } from "../blog/blog.types.js";
import {
  BLOG_ENTITY_TYPE,
  LANDING_ENTITY_TYPE,
  MAX_TRANSLATION_ATTEMPTS,
  WORKER_BATCH_SIZE
} from "./translation.config.js";
import {
  applyBlogItems,
  applyLandingItems,
  extractBlogItems,
  extractLandingItems
} from "./translation.extract.js";
import { translateContent } from "./translation.openai.js";
import {
  SOURCE_LOCALE,
  TARGET_LOCALES,
  type ContentLocale,
  type TargetLocale,
  type TranslatableItem,
  type TranslationEntityType,
  type TranslationMap
} from "./translation.types.js";

/** A `processing` row older than this is considered stale and can be reclaimed. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

function hashItems(items: TranslatableItem[]): string {
  const stable = [...items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => ({ id: item.id, text: item.text, format: item.format }));

  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function normalizeLocale(raw: string | undefined | null): TargetLocale | null {
  if (!raw) {
    return null;
  }

  const value = raw.trim().toLowerCase();

  if (value === "en" || value.startsWith("en-")) {
    return "en";
  }
  if (value === "es" || value.startsWith("es-")) {
    return "es";
  }

  return null;
}

/**
 * Runs a translation task after the HTTP response is sent. Uses Vercel's
 * `waitUntil` in production; falls back to a floating promise locally.
 */
export function runTranslationsInBackground(task: Promise<unknown>): void {
  const safeTask = task.catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "translation.background.failed",
        error: error instanceof Error ? error.message : String(error)
      })
    );
  });

  try {
    waitUntil(safeTask);
  } catch {
    // Not running in a Vercel context (e.g. local dev): the promise still runs.
  }
}

async function enqueueTranslations(
  entityType: TranslationEntityType,
  entityId: string,
  items: TranslatableItem[]
): Promise<boolean> {
  if (!isTranslationConfigured() || items.length === 0) {
    return false;
  }

  const sourceHash = hashItems(items);
  let queued = false;

  for (const locale of TARGET_LOCALES) {
    const existing = await prisma.translation.findUnique({
      where: { entityType_entityId_locale: { entityType, entityId, locale } }
    });

    if (existing && existing.status === "completed" && existing.sourceHash === sourceHash) {
      continue;
    }

    await prisma.translation.upsert({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      create: { entityType, entityId, locale, status: "pending", sourceHash },
      update: { status: "pending", sourceHash, error: null, attempts: 0 }
    });

    queued = true;
  }

  return queued;
}

export async function enqueueLandingTranslations(
  pageId: string,
  publishedContent: unknown
): Promise<boolean> {
  return enqueueTranslations(LANDING_ENTITY_TYPE, pageId, extractLandingItems(publishedContent));
}

export async function enqueueBlogTranslations(
  article: Pick<BlogArticleRecord, "id" | "title" | "content" | "headerImageAlt">
): Promise<boolean> {
  return enqueueTranslations(BLOG_ENTITY_TYPE, article.id, extractBlogItems(article));
}

async function loadSourceItems(
  entityType: string,
  entityId: string
): Promise<TranslatableItem[] | null> {
  if (entityType === LANDING_ENTITY_TYPE) {
    const page = await prisma.landingPage.findUnique({
      where: { id: entityId },
      select: { publishedContent: true }
    });

    if (!page?.publishedContent) {
      return null;
    }

    return extractLandingItems(page.publishedContent);
  }

  if (entityType === BLOG_ENTITY_TYPE) {
    const article = await prisma.blogArticle.findUnique({
      where: { id: entityId },
      select: { title: true, content: true, headerImageAlt: true }
    });

    if (!article) {
      return null;
    }

    return extractBlogItems(article);
  }

  return null;
}

async function tryClaim(rowId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const claimed = await prisma.translation.updateMany({
    where: {
      id: rowId,
      OR: [
        { status: "pending" },
        { status: "failed", attempts: { lt: MAX_TRANSLATION_ATTEMPTS } },
        { status: "processing", updatedAt: { lt: cutoff } }
      ]
    },
    data: { status: "processing" }
  });

  return claimed.count > 0;
}

async function processClaimedRow(row: Translation): Promise<void> {
  try {
    const items = await loadSourceItems(row.entityType, row.entityId);

    if (!items) {
      await prisma.translation.update({
        where: { id: row.id },
        data: {
          status: "completed",
          content: {},
          translatedAt: new Date(),
          error: null,
          attempts: { increment: 1 }
        }
      });
      return;
    }

    const sourceHash = hashItems(items);
    const map = await translateContent(items, row.locale);

    await prisma.translation.update({
      where: { id: row.id },
      data: {
        status: "completed",
        content: map,
        sourceHash,
        model: env.OPENAI_TRANSLATION_MODEL,
        error: null,
        translatedAt: new Date(),
        attempts: { increment: 1 }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.translation.update({
      where: { id: row.id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        error: message.slice(0, 1000)
      }
    });

    console.error(
      JSON.stringify({
        event: "translation.process.failed",
        translationId: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        locale: row.locale,
        error: message
      })
    );
  }
}

/**
 * Processes the pending translations for a single entity immediately.
 * Intended to be scheduled via `runTranslationsInBackground` after a publish.
 */
export async function processEntityTranslations(
  entityType: TranslationEntityType,
  entityId: string
): Promise<void> {
  if (!isTranslationConfigured()) {
    return;
  }

  const rows = await prisma.translation.findMany({
    where: {
      entityType,
      entityId,
      OR: [{ status: "pending" }, { status: "failed", attempts: { lt: MAX_TRANSLATION_ATTEMPTS } }]
    }
  });

  for (const row of rows) {
    if (await tryClaim(row.id)) {
      await processClaimedRow(row);
    }
  }
}

/**
 * Worker entrypoint: claims and processes a batch of outstanding translations.
 * Used by the internal cron route as a safety net for retries/stuck jobs.
 */
export async function runPendingTranslations(
  limit = WORKER_BATCH_SIZE
): Promise<{ processed: number }> {
  if (!isTranslationConfigured()) {
    return { processed: 0 };
  }

  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const rows = await prisma.translation.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "failed", attempts: { lt: MAX_TRANSLATION_ATTEMPTS } },
        { status: "processing", updatedAt: { lt: cutoff } }
      ]
    },
    orderBy: { updatedAt: "asc" },
    take: limit
  });

  let processed = 0;

  for (const row of rows) {
    if (await tryClaim(row.id)) {
      await processClaimedRow(row);
      processed += 1;
    }
  }

  return { processed };
}

export async function findCompletedLocalesByEntityIds(
  entityType: TranslationEntityType,
  entityIds: string[]
): Promise<Map<string, ContentLocale[]>> {
  const result = new Map<string, ContentLocale[]>();

  for (const entityId of entityIds) {
    result.set(entityId, [SOURCE_LOCALE]);
  }

  if (entityIds.length === 0) {
    return result;
  }

  const rows = await prisma.translation.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      status: "completed"
    },
    select: { entityId: true, locale: true, content: true }
  });

  const translatedLocalesByEntityId = new Map<string, Set<TargetLocale>>();

  for (const row of rows) {
    if (!row.content) {
      continue;
    }
    const locales = translatedLocalesByEntityId.get(row.entityId) ?? new Set<TargetLocale>();
    locales.add(row.locale);
    translatedLocalesByEntityId.set(row.entityId, locales);
  }

  for (const entityId of entityIds) {
    const translated = translatedLocalesByEntityId.get(entityId);
    if (!translated) {
      continue;
    }

    const locales: ContentLocale[] = [SOURCE_LOCALE];
    for (const locale of TARGET_LOCALES) {
      if (translated.has(locale)) {
        locales.push(locale);
      }
    }
    result.set(entityId, locales);
  }

  return result;
}

async function findCompletedTranslation(
  entityType: TranslationEntityType,
  entityId: string,
  locale: TargetLocale
): Promise<TranslationMap | null> {
  const row = await prisma.translation.findUnique({
    where: { entityType_entityId_locale: { entityType, entityId, locale } }
  });

  if (!row || row.status !== "completed" || !row.content) {
    return null;
  }

  return row.content as TranslationMap;
}

export async function localizeLandingContent<T extends Record<string, unknown>>(
  publishedContent: T,
  pageId: string,
  locale: TargetLocale | null
): Promise<T> {
  if (!locale) {
    return publishedContent;
  }

  const map = await findCompletedTranslation(LANDING_ENTITY_TYPE, pageId, locale);
  if (!map) {
    return publishedContent;
  }

  return applyLandingItems(publishedContent, map) as T;
}

export async function localizeBlogArticle<T extends BlogArticleRecord>(
  article: T,
  locale: TargetLocale | null
): Promise<T> {
  if (!locale) {
    return article;
  }

  const map = await findCompletedTranslation(BLOG_ENTITY_TYPE, article.id, locale);
  if (!map) {
    return article;
  }

  return applyBlogItems(article, map);
}

export async function localizeBlogArticles<T extends BlogArticleRecord>(
  articles: T[],
  locale: TargetLocale | null
): Promise<T[]> {
  if (!locale || articles.length === 0) {
    return articles;
  }

  const rows = await prisma.translation.findMany({
    where: {
      entityType: BLOG_ENTITY_TYPE,
      entityId: { in: articles.map((article) => article.id) },
      locale,
      status: "completed"
    }
  });

  const mapByEntityId = new Map<string, TranslationMap>(
    rows
      .filter((row) => row.content)
      .map((row) => [row.entityId, row.content as TranslationMap])
  );

  return articles.map((article) => {
    const map = mapByEntityId.get(article.id);
    return map ? applyBlogItems(article, map) : article;
  });
}
