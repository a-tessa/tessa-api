import { randomUUID } from "node:crypto";
import type { LandingPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import { buildHeroSectionImagePath } from "../assets/assets.utils.js";
import { collectionConfigs } from "./content.config.js";
import {
  ensureCollectionIds,
  hasLegacyHeroSectionFormat,
  parseDraftContent,
  sanitizeContentForPublish,
  toDraftContentInput
} from "./content.utils.js";
import { heroSectionSchema } from "./content.schemas.js";
import type {
  AdminContentRecord,
  CollectionConfig,
  DraftContent,
  DraftServicesPageItem,
  HeroSection,
  HeroSectionInput,
  PublicContentRecord,
  SingularSectionConfig
} from "./content.types.js";

const MAIN_CONTENT_SLUG = "home";
const MAIN_CONTENT_TITLE = "Home";
const HERO_ASSET_FILTER = {
  entityType: "landingPage",
  entityId: MAIN_CONTENT_SLUG,
  sectionKey: "heroSection",
  fieldKey: "image"
} as const;

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
  let changed = hasLegacyHeroSectionFormat(page.draftContent);

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

function getHeroSectionOrThrow(content: DraftContent) {
  const heroSection = content.heroSection;

  if (!heroSection) {
    notFound("Seção hero não encontrada.");
  }

  return heroSection;
}

function getUniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}

async function cleanupBlobUrls(urls: string[]) {
  for (const url of getUniqueUrls(urls)) {
    try {
      await deleteBlobAsset(url);
    } catch (error) {
      console.error("Falha ao remover asset do Blob.", {
        url,
        error
      });
    }
  }
}

async function saveHeroSectionContent(
  mode: "create" | "update",
  input: HeroSectionInput,
  uploadsByIndex: Map<number, File>,
  altsByIndex: Map<number, string>,
  userId: string
): Promise<HeroSection> {
  const page =
    mode === "create"
      ? await ensureMainDraftPageExists(userId)
      : await getMainPageOrThrow();

  const content = await getMainDraftContent(page);
  const existingHeroSection = content.heroSection;

  if (mode === "create" && existingHeroSection) {
    conflict("Seção hero já cadastrada.");
  }

  if (mode === "update" && !existingHeroSection) {
    notFound("Seção hero não encontrada.");
  }

  const currentHeroSection = existingHeroSection ?? [];

  for (const [index, topic] of input.entries()) {
    const hasCurrentImage = Boolean(currentHeroSection[index]?.image);

    if (!uploadsByIndex.has(index) && !topic.image && !hasCurrentImage) {
      badRequest(`Imagem do tópico ${index} é obrigatória.`);
    }
  }

  const uploadedAssets = new Map<number, Awaited<ReturnType<typeof uploadPublicAsset>>>();
  const preparedAssets = new Map<number, Awaited<ReturnType<typeof prepareImageAsset>>>();
  const uploadedUrls: string[] = [];

  try {
    for (const [index, file] of [...uploadsByIndex.entries()].sort((a, b) => a[0] - b[0])) {
      const preparedAsset = await prepareImageAsset(file);
      const pathname = buildHeroSectionImagePath(index, preparedAsset.originalFilename);
      const uploadedBlob = await uploadPublicAsset(pathname, preparedAsset);

      preparedAssets.set(index, preparedAsset);
      uploadedAssets.set(index, uploadedBlob);
      uploadedUrls.push(uploadedBlob.url);
    }
  } catch (error) {
    await cleanupBlobUrls(uploadedUrls);
    throw error;
  }

  const nextHeroSection = input.map((topic, index) => ({
    ...topic,
    image: uploadedAssets.get(index)?.url ?? topic.image ?? currentHeroSection[index]?.image ?? ""
  }));

  const validatedHeroSection = heroSectionSchema.parse(nextHeroSection);
  const previousAssets = await prisma.asset.findMany({
    where: HERO_ASSET_FILTER,
    orderBy: {
      createdAt: "desc"
    }
  });

  const previousAssetByUrl = new Map<string, (typeof previousAssets)[number]>();
  const previousAssetBySlot = new Map<number, (typeof previousAssets)[number]>();

  for (const asset of previousAssets) {
    if (!previousAssetByUrl.has(asset.url)) {
      previousAssetByUrl.set(asset.url, asset);
    }

    if (asset.slot !== null && !previousAssetBySlot.has(asset.slot)) {
      previousAssetBySlot.set(asset.slot, asset);
    }
  }

  const assetsToPersist = validatedHeroSection.flatMap((topic, index) => {
    const uploadedBlob = uploadedAssets.get(index);
    const providedAlt = altsByIndex.get(index);

    if (uploadedBlob) {
      const preparedAsset = preparedAssets.get(index)!;
      const previousAsset = previousAssetBySlot.get(index);

      return [
        {
          kind: "image",
          entityType: "landingPage",
          entityId: MAIN_CONTENT_SLUG,
          sectionKey: "heroSection",
          fieldKey: "image",
          slot: index,
          pathname: uploadedBlob.pathname,
          url: uploadedBlob.url,
          mimeType: preparedAsset.contentType,
          sizeBytes: preparedAsset.sizeBytes,
          originalFilename: preparedAsset.originalFilename,
          alt: providedAlt ?? previousAsset?.alt ?? null,
          createdById: userId
        }
      ];
    }

    const retainedAsset = previousAssetByUrl.get(topic.image);
    if (!retainedAsset) {
      return [];
    }

    return [
      {
        kind: retainedAsset.kind,
        entityType: retainedAsset.entityType,
        entityId: retainedAsset.entityId,
        sectionKey: retainedAsset.sectionKey,
        fieldKey: retainedAsset.fieldKey,
        slot: index,
        pathname: retainedAsset.pathname,
        url: retainedAsset.url,
        mimeType: retainedAsset.mimeType,
        sizeBytes: retainedAsset.sizeBytes,
        originalFilename: retainedAsset.originalFilename,
        alt: providedAlt ?? retainedAsset.alt ?? null,
        createdById: retainedAsset.createdById
      }
    ];
  });

  const finalImageUrls = new Set(validatedHeroSection.map((topic) => topic.image));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput({
            ...content,
            heroSection: validatedHeroSection
          } as DraftContent),
          status: "draft",
          updatedById: userId
        }
      });

      await tx.asset.deleteMany({
        where: HERO_ASSET_FILTER
      });

      if (assetsToPersist.length > 0) {
        await tx.asset.createMany({
          data: assetsToPersist
        });
      }
    });
  } catch (error) {
    await cleanupBlobUrls(uploadedUrls);
    throw error;
  }

  const previousUrlsToDelete = previousAssets
    .map((asset) => asset.url)
    .filter((url) => !finalImageUrls.has(url));

  await cleanupBlobUrls(previousUrlsToDelete);

  return validatedHeroSection;
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

export async function createHeroSection(
  input: HeroSectionInput,
  uploadsByIndex: Map<number, File>,
  altsByIndex: Map<number, string>,
  userId: string
) {
  return saveHeroSectionContent("create", input, uploadsByIndex, altsByIndex, userId);
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

export async function updateHeroSection(
  input: HeroSectionInput,
  uploadsByIndex: Map<number, File>,
  altsByIndex: Map<number, string>,
  userId: string
) {
  return saveHeroSectionContent("update", input, uploadsByIndex, altsByIndex, userId);
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

export async function deleteHeroSection(userId: string) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);

  getHeroSectionOrThrow(content);

  const previousAssets = await prisma.asset.findMany({
    where: HERO_ASSET_FILTER,
    orderBy: {
      createdAt: "desc"
    }
  });

  const nextContent = { ...content };
  delete nextContent.heroSection;

  await prisma.$transaction(async (tx) => {
    await tx.landingPage.update({
      where: { id: page.id },
      data: {
        draftContent: toDraftContentInput(nextContent),
        status: "draft",
        updatedById: userId
      }
    });

    await tx.asset.deleteMany({
      where: HERO_ASSET_FILTER
    });
  });

  await cleanupBlobUrls(previousAssets.map((asset) => asset.url));
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
