import { randomUUID } from "node:crypto";
import type { LandingPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { conflict, notFound } from "../../lib/http.js";
import { collectionConfigs } from "./content.config.js";
import { ensureCollectionIds, parseDraftContent, sanitizeContentForPublish, toDraftContentInput } from "./content.utils.js";
import type {
  AdminContentRecord,
  CollectionConfig,
  DraftContent,
  DraftServicesPageItem,
  PublicContentRecord,
  SingularSectionConfig
} from "./content.types.js";

const MAIN_CONTENT_SLUG = "home";
const MAIN_CONTENT_TITLE = "Home";

async function findMainPage(): Promise<LandingPage | null> {
  return prisma.landingPage.findUnique({
    where: { slug: MAIN_CONTENT_SLUG }
  });
}

async function ensureMainDraftPageExists(userId: string): Promise<LandingPage> {
  const existingPage = await findMainPage();

  if (existingPage) {
    return existingPage;
  }

  return prisma.landingPage.create({
    data: {
      slug: MAIN_CONTENT_SLUG,
      title: MAIN_CONTENT_TITLE,
      draftContent: {} as Prisma.InputJsonValue,
      status: "draft",
      updatedById: userId
    }
  });
}

async function getMainPageOrThrow(): Promise<LandingPage> {
  const page = await findMainPage();

  if (!page) {
    notFound("Conteúdo principal não encontrado.");
  }

  return page;
}

async function getMainDraftContent(page: LandingPage): Promise<DraftContent> {
  const parsedContent = parseDraftContent(page.draftContent);
  let nextContent = parsedContent;
  let changed = false;

  for (const config of collectionConfigs) {
    const normalized = ensureCollectionIds(nextContent, config);
    nextContent = normalized.content;
    changed = changed || normalized.changed;
  }

  if (!changed) {
    return nextContent;
  }

  await prisma.landingPage.update({
    where: { id: page.id },
    data: {
      draftContent: toDraftContentInput(nextContent),
      updatedById: page.updatedById
    }
  });

  return nextContent;
}

async function saveMainDraftContent(pageId: string, content: DraftContent, userId: string) {
  return prisma.landingPage.update({
    where: { id: pageId },
    data: {
      draftContent: toDraftContentInput(content),
      status: "draft",
      updatedById: userId
    }
  });
}

function getEmptyAdminContent(): AdminContentRecord {
  return {
    status: "draft",
    content: {},
    publishedContent: null,
    publishedAt: null,
    updatedAt: null
  };
}

function getServicesPages(content: DraftContent): DraftServicesPageItem[] {
  return Array.isArray(content.servicesPages) ? content.servicesPages : [];
}

export async function getPublicContent(): Promise<PublicContentRecord> {
  const page = await findMainPage();

  if (!page || !page.publishedContent) {
    notFound("Conteúdo publicado não encontrado.");
  }

  return {
    content: sanitizeContentForPublish(page.publishedContent) as Record<string, unknown>,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt
  };
}

export async function getAdminContent(): Promise<AdminContentRecord> {
  const page = await findMainPage();

  if (!page) {
    return getEmptyAdminContent();
  }

  const content = await getMainDraftContent(page);

  return {
    status: page.status,
    content,
    publishedContent: page.publishedContent
      ? (sanitizeContentForPublish(page.publishedContent) as Record<string, unknown>)
      : null,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt
  };
}

export async function publishMainContent(userId: string): Promise<AdminContentRecord> {
  const existingPage = await getMainPageOrThrow();
  const content = await getMainDraftContent(existingPage);
  const publishedContent = sanitizeContentForPublish(content);

  const page = await prisma.landingPage.update({
    where: { id: existingPage.id },
    data: {
      status: "published",
      draftContent: toDraftContentInput(content),
      publishedContent,
      publishedAt: new Date(),
      publishedById: userId,
      updatedById: userId
    }
  });

  return {
    status: page.status,
    content,
    publishedContent: publishedContent as Record<string, unknown>,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt
  };
}

export async function getSingularSection(config: SingularSectionConfig) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const section = content[config.key];

  if (!section) {
    notFound(`${config.label} não encontrada.`);
  }

  return section;
}

export async function createSingularSection(
  config: SingularSectionConfig,
  input: unknown,
  userId: string
) {
  const page = await ensureMainDraftPageExists(userId);
  const content = await getMainDraftContent(page);

  if (content[config.key]) {
    conflict(`${config.label} já cadastrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: input
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return input;
}

export async function updateSingularSection(
  config: SingularSectionConfig,
  input: unknown,
  userId: string
) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);

  if (!content[config.key]) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: input
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return input;
}

export async function deleteSingularSection(
  config: SingularSectionConfig,
  userId: string
) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);

  if (!content[config.key]) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = { ...content };
  delete nextContent[config.key];

  await saveMainDraftContent(page.id, nextContent, userId);
}

export async function listCollectionItems(config: CollectionConfig) {
  const page = await findMainPage();

  if (!page) {
    return [];
  }

  const content = await getMainDraftContent(page);
  return ensureCollectionIds(content, config).items;
}

export async function listServicePages() {
  const page = await findMainPage();

  if (!page) {
    return [];
  }

  const content = await getMainDraftContent(page);
  return getServicesPages(content);
}

export async function getServicePage(slug: string) {
  const servicesPages = await listServicePages();
  const item = servicesPages.find((currentItem) => currentItem.slug === slug);

  if (!item) {
    notFound("Página de serviço não encontrada.");
  }

  return item;
}

export async function getCollectionItem(config: CollectionConfig, itemId: string) {
  const items = await listCollectionItems(config);
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    notFound(`${config.label} não encontrada.`);
  }

  return item;
}

export async function createCollectionItem(
  config: CollectionConfig,
  input: Record<string, unknown>,
  userId: string
) {
  const page = await ensureMainDraftPageExists(userId);
  const content = await getMainDraftContent(page);
  const items = ensureCollectionIds(content, config).items;
  const item = {
    ...input,
    id: randomUUID()
  };

  const nextContent = {
    ...content,
    [config.key]: [...items, item]
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return item;
}

export async function createServicePage(
  input: DraftServicesPageItem,
  userId: string
) {
  const page = await ensureMainDraftPageExists(userId);
  const content = await getMainDraftContent(page);
  const servicesPages = getServicesPages(content);

  if (servicesPages.some((currentItem) => currentItem.slug === input.slug)) {
    conflict("Já existe uma página de serviço com este slug.");
  }

  const nextContent = {
    ...content,
    servicesPages: [...servicesPages, input]
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return input;
}

export async function updateCollectionItem(
  config: CollectionConfig,
  itemId: string,
  input: Record<string, unknown>,
  userId: string
) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
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

  await saveMainDraftContent(page.id, nextContent, userId);

  return updatedItem;
}

export async function updateServicePage(
  currentSlug: string,
  input: DraftServicesPageItem,
  userId: string
) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const servicesPages = getServicesPages(content);
  const existingItem = servicesPages.find((currentItem) => currentItem.slug === currentSlug);

  if (!existingItem) {
    notFound("Página de serviço não encontrada.");
  }

  if (
    input.slug !== currentSlug &&
    servicesPages.some((currentItem) => currentItem.slug === input.slug)
  ) {
    conflict("Já existe uma página de serviço com este slug.");
  }

  const nextContent = {
    ...content,
    servicesPages: servicesPages.map((currentItem) =>
      currentItem.slug === currentSlug ? input : currentItem
    )
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return input;
}

export async function deleteCollectionItem(
  config: CollectionConfig,
  itemId: string,
  userId: string
) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const items = ensureCollectionIds(content, config).items;
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    notFound(`${config.label} não encontrada.`);
  }

  const nextContent = {
    ...content,
    [config.key]: items.filter((currentItem) => currentItem.id !== itemId)
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);
}

export async function deleteServicePage(slug: string, userId: string) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const servicesPages = getServicesPages(content);
  const existingItem = servicesPages.find((currentItem) => currentItem.slug === slug);

  if (!existingItem) {
    notFound("Página de serviço não encontrada.");
  }

  const nextContent = {
    ...content,
    servicesPages: servicesPages.filter((currentItem) => currentItem.slug !== slug)
  } as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);
}
