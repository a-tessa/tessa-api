import { randomUUID } from "node:crypto";
import type { LandingPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { conflict, notFound } from "../../lib/http.js";
import { ensureAllCollectionIds, ensureCollectionIds, parseDraftContent, sanitizeContentForPublish, toDraftContentInput } from "./content.utils.js";
import type {
  AdminPageRecord,
  ContentPagesListResult,
  CollectionConfig,
  DraftContent,
  PublicPageRecord,
  PageListQuery,
  PageState,
  PageUpsertInput,
  SingularSectionConfig
} from "./content.types.js";

function titleFromSlug(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  const titled = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return titled.length >= 2 ? titled : `Página ${slug}`;
}

/** Garante uma landing page em rascunho para POST de seção/item (primeira criação). */
async function ensureDraftPageExists(slug: string, userId: string): Promise<void> {
  const exists = await prisma.landingPage.findUnique({
    where: { slug },
    select: { id: true }
  });
  if (exists) return;

  await prisma.landingPage.create({
    data: {
      slug,
      title: titleFromSlug(slug),
      draftContent: {} as Prisma.InputJsonValue,
      status: "draft",
      updatedById: userId
    }
  });
}

async function getPageOrThrow(slug: string): Promise<LandingPage> {
  const page = await prisma.landingPage.findUnique({
    where: { slug }
  });

  if (!page) {
    notFound("Página não encontrada.");
  }

  return page;
}

async function getPageState(slug: string): Promise<PageState> {
  const page = await getPageOrThrow(slug);
  const normalized = ensureAllCollectionIds(parseDraftContent(page.draftContent));

  if (!normalized.changed) {
    return {
      page,
      content: normalized.content
    };
  }

  const updatedPage = await prisma.landingPage.update({
    where: { id: page.id },
    data: {
      draftContent: toDraftContentInput(normalized.content),
      updatedById: page.updatedById
    }
  });

  return {
    page: updatedPage,
    content: normalized.content
  };
}

async function saveDraftContent(pageId: string, content: DraftContent, userId: string) {
  return prisma.landingPage.update({
    where: { id: pageId },
    data: {
      draftContent: toDraftContentInput(content),
      status: "draft",
      updatedById: userId
    }
  });
}

export async function getPublishedPage(slug: string): Promise<PublicPageRecord> {
  const page = await prisma.landingPage.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      seoTitle: true,
      seoDescription: true,
      publishedContent: true,
      publishedAt: true,
      updatedAt: true
    }
  });

  if (!page || !page.publishedContent) {
    notFound("Página publicada não encontrada.");
  }

  return {
    ...page,
    publishedContent: sanitizeContentForPublish(page.publishedContent) as Record<string, unknown>
  };
}

export async function listAdminPages(query: PageListQuery): Promise<ContentPagesListResult> {
  const skip = (query.page - 1) * query.perPage;

  const [pages, total] = await Promise.all([
    prisma.landingPage.findMany({
      skip,
      take: query.perPage,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        updatedAt: true,
        publishedAt: true
      }
    }),
    prisma.landingPage.count()
  ]);

  return {
    pages,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function getAdminPage(slug: string): Promise<AdminPageRecord> {
  const { page, content } = await getPageState(slug);

  return {
    ...page,
    draftContent: content,
    publishedContent: page.publishedContent
      ? (sanitizeContentForPublish(page.publishedContent) as Record<string, unknown>)
      : null
  };
}

export async function upsertPage(
  slug: string,
  input: PageUpsertInput,
  userId: string
): Promise<AdminPageRecord> {
  const normalizedDraftContent = ensureAllCollectionIds(
    parseDraftContent(input.draftContent)
  ).content;

  const page = await prisma.landingPage.upsert({
    where: { slug },
    create: {
      slug,
      title: input.title,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      draftContent: toDraftContentInput(normalizedDraftContent),
      status: "draft",
      updatedById: userId
    },
    update: {
      title: input.title,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      draftContent: toDraftContentInput(normalizedDraftContent),
      status: "draft",
      updatedById: userId
    }
  });

  return {
    ...page,
    draftContent: normalizedDraftContent,
    publishedContent: page.publishedContent
      ? (sanitizeContentForPublish(page.publishedContent) as Record<string, unknown>)
      : null
  };
}

export async function publishPage(slug: string, userId: string): Promise<AdminPageRecord> {
  const existingPage = await getPageOrThrow(slug);
  const normalizedDraftContent = ensureAllCollectionIds(
    parseDraftContent(existingPage.draftContent)
  ).content;
  const publishedContent = sanitizeContentForPublish(normalizedDraftContent);

  const page = await prisma.landingPage.update({
    where: { slug },
    data: {
      status: "published",
      draftContent: toDraftContentInput(normalizedDraftContent),
      publishedContent,
      publishedAt: new Date(),
      publishedById: userId,
      updatedById: userId
    }
  });

  return {
    ...page,
    draftContent: normalizedDraftContent,
    publishedContent: publishedContent as Record<string, unknown>
  } satisfies AdminPageRecord;
}

export async function getSingularSection(slug: string, config: SingularSectionConfig) {
  const { content } = await getPageState(slug);
  const section = content[config.key];

  if (!section) {
    notFound(`${config.label} não encontrada.`);
  }

  return section;
}

export async function createSingularSection(
  slug: string,
  config: SingularSectionConfig,
  input: unknown,
  userId: string
) {
  await ensureDraftPageExists(slug, userId);
  const { page, content } = await getPageState(slug);

  if (content[config.key]) {
    conflict(`${config.label} já cadastrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: input
  } as DraftContent;

  await saveDraftContent(page.id, nextContent, userId);

  return input;
}

export async function updateSingularSection(
  slug: string,
  config: SingularSectionConfig,
  input: unknown,
  userId: string
) {
  const { page, content } = await getPageState(slug);

  if (!content[config.key]) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: input
  } as DraftContent;

  await saveDraftContent(page.id, nextContent, userId);

  return input;
}

export async function deleteSingularSection(
  slug: string,
  config: SingularSectionConfig,
  userId: string
) {
  const { page, content } = await getPageState(slug);

  if (!content[config.key]) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = { ...content };
  delete nextContent[config.key];

  await saveDraftContent(page.id, nextContent, userId);
}

export async function listCollectionItems(slug: string, config: CollectionConfig) {
  const { content } = await getPageState(slug);
  return ensureCollectionIds(content, config).items;
}

export async function getCollectionItem(
  slug: string,
  config: CollectionConfig,
  itemId: string
) {
  const items = await listCollectionItems(slug, config);
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    notFound(`${config.label} não encontrada.`);
  }

  return item;
}

export async function createCollectionItem(
  slug: string,
  config: CollectionConfig,
  input: Record<string, unknown>,
  userId: string
) {
  await ensureDraftPageExists(slug, userId);
  const { page, content } = await getPageState(slug);
  const items = ensureCollectionIds(content, config).items;
  const item = {
    ...input,
    id: randomUUID()
  };

  const nextContent = {
    ...content,
    [config.key]: [...items, item]
  } as DraftContent;

  await saveDraftContent(page.id, nextContent, userId);

  return item;
}

export async function updateCollectionItem(
  slug: string,
  config: CollectionConfig,
  itemId: string,
  input: Record<string, unknown>,
  userId: string
) {
  const { page, content } = await getPageState(slug);
  const items = ensureCollectionIds(content, config).items;
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    notFound(`${config.label} não encontrada.`);
  }

  const updatedItem = {
    ...input,
    id: itemId
  };

  const nextContent = {
    ...content,
    [config.key]: items.map((currentItem) =>
      currentItem.id === itemId ? updatedItem : currentItem
    )
  } as DraftContent;

  await saveDraftContent(page.id, nextContent, userId);

  return updatedItem;
}

export async function deleteCollectionItem(
  slug: string,
  config: CollectionConfig,
  itemId: string,
  userId: string
) {
  const { page, content } = await getPageState(slug);
  const items = ensureCollectionIds(content, config).items;
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: items.filter((currentItem) => currentItem.id !== itemId)
  } as DraftContent;

  await saveDraftContent(page.id, nextContent, userId);
}
