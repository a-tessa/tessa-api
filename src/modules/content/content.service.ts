import { randomUUID } from "node:crypto";
import type { LandingPage } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import {
  deleteBlobAsset,
  prepareClientLogoAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import {
  buildClientLogoPath,
  buildHeroSectionImagePath,
  buildOperationSectionImagePath,
  buildServicePageBackgroundImagePath,
  buildServicePageExampleImagePath
} from "../assets/assets.utils.js";
import { collectionConfigs } from "./content.config.js";
import {
  buildScenerySection,
  ensureCollectionIds,
  hasLegacyHeroSectionFormat,
  parseDraftContent,
  resolveCategorySlugFromCategories,
  sanitizeContentForPublish,
  toDraftContentInput,
  withDerivedScenery
} from "./content.utils.js";
import { listApprovedNpsResponses } from "../nps/nps.service.js";
import {
  CLIENT_LOGO_MAX_BYTES,
  clientItemSchema,
  heroSectionSchema,
  operationSectionSchema,
  servicesPageMutationSchema
} from "./content.schemas.js";
import type {
  AdminContentRecord,
  ClientItemInput,
  DraftCategory,
  CollectionConfig,
  DraftClientItem,
  DraftContent,
  DraftServicesPageItem,
  HeroSection,
  HeroSectionInput,
  OperationSection,
  OperationSectionMultipartInput,
  ServicePageMultipartInput,
  ServicesPageItem,
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
const OPERATION_SECTION_ASSET_FILTER = {
  entityType: "landingPage",
  entityId: MAIN_CONTENT_SLUG,
  sectionKey: "operationSection",
  fieldKey: "images"
} as const;
const CLIENTS_ASSET_FILTER = {
  entityType: "landingPage",
  entityId: MAIN_CONTENT_SLUG,
  sectionKey: "clients",
  fieldKey: "logoUrl"
} as const;
const SERVICE_PAGE_ASSET_ENTITY_TYPE = "servicePage";
const SERVICE_PAGE_ASSET_SECTION_KEY = "servicesPages";
const SERVICE_PAGE_BACKGROUND_FIELD_KEY = "backgroundImageUrl";
const SERVICE_PAGE_IMAGES_FIELD_KEY = "images";

function getServicePageAssetFilter(slug: string) {
  return {
    entityType: SERVICE_PAGE_ASSET_ENTITY_TYPE,
    entityId: slug,
    sectionKey: SERVICE_PAGE_ASSET_SECTION_KEY
  } as const;
}

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

  const normalizedServicesPages = normalizeServicePageCategories(nextContent);
  nextContent = normalizedServicesPages.content;
  changed = changed || normalizedServicesPages.changed;

  const normalizedClients = ensureClientsCollectionIds(nextContent);
  nextContent = normalizedClients.content;
  changed = changed || normalizedClients.changed;

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
    content: withDerivedScenery({}),
    publishedContent: null,
    publishedAt: null,
    updatedAt: null
  };
}

function getServicesPages(content: DraftContent): DraftServicesPageItem[] {
  return Array.isArray(content.servicesPages) ? content.servicesPages : [];
}

function getCategories(content: DraftContent): DraftCategory[] {
  return Array.isArray(content.categories) ? content.categories : [];
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

function normalizeComparableValue(value: string) {
  return value.trim().toLowerCase();
}

function isCategoriesCollection(config: CollectionConfig) {
  return config.key === "categories";
}

function normalizeServicePageCategories(content: DraftContent) {
  const servicesPages = getServicesPages(content);

  if (servicesPages.length === 0) {
    return {
      content,
      changed: false
    };
  }

  const categories = getCategories(content);

  if (categories.length === 0) {
    return {
      content,
      changed: false
    };
  }

  let changed = false;
  const normalizedServicesPages = servicesPages.map((servicePage) => {
    const categorySlug = resolveCategorySlugFromCategories(categories, servicePage.category);

    if (!categorySlug || categorySlug === servicePage.category) {
      return servicePage;
    }

    changed = true;

    return {
      ...servicePage,
      category: categorySlug
    };
  });

  if (!changed) {
    return {
      content,
      changed: false
    };
  }

  return {
    content: {
      ...content,
      servicesPages: normalizedServicesPages
    } as DraftContent,
    changed: true
  };
}

function assertCategorySlugAvailable(
  content: DraftContent,
  slug: string,
  excludedItemId?: string
) {
  const normalizedSlug = normalizeComparableValue(slug);
  const conflictCategory = getCategories(content).find((category) => {
    if (excludedItemId && category.id === excludedItemId) {
      return false;
    }

    return normalizeComparableValue(category.slug) === normalizedSlug;
  });

  if (conflictCategory) {
    conflict("Já existe uma categoria com este slug.");
  }
}

function assertCategoryCanBeDeleted(content: DraftContent, itemId: string) {
  const category = getCategories(content).find((currentItem) => currentItem.id === itemId);

  if (!category) {
    return;
  }

  const normalizedSlug = normalizeComparableValue(category.slug);
  const normalizedName = normalizeComparableValue(category.name);
  const relatedServicePage = getServicesPages(content).find((servicePage) => {
    const normalizedCategory = normalizeComparableValue(servicePage.category);

    return normalizedCategory === normalizedSlug || normalizedCategory === normalizedName;
  });

  if (relatedServicePage) {
    conflict("Categoria está em uso em conteúdo cadastrado e não pode ser removida.");
  }
}

function resolveServicePageCategory(content: DraftContent, value: string) {
  const categorySlug = resolveCategorySlugFromCategories(getCategories(content), value);

  if (!categorySlug) {
    badRequest("Categoria informada para a página de serviço não existe.");
  }

  return categorySlug;
}

function syncServicesPagesWithCategory(
  servicesPages: DraftServicesPageItem[],
  previousCategory: Pick<DraftCategory, "name" | "slug">,
  nextCategory: Pick<DraftCategory, "slug">
) {
  const previousSlug = normalizeComparableValue(previousCategory.slug);
  const previousName = normalizeComparableValue(previousCategory.name);

  return servicesPages.map((servicePage) => {
    const currentCategory = normalizeComparableValue(servicePage.category);

    if (currentCategory !== previousSlug && currentCategory !== previousName) {
      return servicePage;
    }

    return {
      ...servicePage,
      category: nextCategory.slug
    };
  });
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

async function saveServicePageContent(
  mode: "create" | "update",
  currentSlug: string | null,
  input: ServicesPageItem | ServicePageMultipartInput,
  backgroundUpload: File | null,
  uploadsByIndex: Map<number, File>,
  userId: string
): Promise<DraftServicesPageItem> {
  const page =
    mode === "create"
      ? await ensureMainDraftPageExists(userId)
      : await getMainPageOrThrow();

  const content = await getMainDraftContent(page);
  const servicesPages = getServicesPages(content);
  const existingItem =
    mode === "update" && currentSlug
      ? servicesPages.find((currentItem) => currentItem.slug === currentSlug)
      : null;

  if (mode === "update" && !existingItem) {
    notFound("Página de serviço não encontrada.");
  }

  const nextSlug = input.slug;

  if (
    servicesPages.some((currentItem) =>
      mode === "update" && currentSlug
        ? currentItem.slug !== currentSlug && currentItem.slug === nextSlug
        : currentItem.slug === nextSlug
    )
  ) {
    conflict("Já existe uma página de serviço com este slug.");
  }

  const existingImages = existingItem?.images ?? [];

  if (!backgroundUpload && !input.backgroundImageUrl && !existingItem?.backgroundImageUrl) {
    badRequest("Imagem de background do serviço é obrigatória.");
  }

  const maxUploadedIndex = uploadsByIndex.size > 0 ? Math.max(...uploadsByIndex.keys()) : -1;
  const targetImageCount = Array.isArray(input.images)
    ? input.images.length
    : mode === "create"
      ? maxUploadedIndex + 1
      : Math.max(existingImages.length, maxUploadedIndex + 1);

  if (targetImageCount < 1) {
    badRequest("Ao menos uma imagem do serviço é obrigatória.");
  }

  const requestedImages: Array<{ imgUrl?: string }> = Array.isArray(input.images)
    ? input.images
    : Array.from({ length: targetImageCount }, () => ({}));

  for (let index = 0; index < targetImageCount; index += 1) {
    const requestedImage = requestedImages[index];
    const hasCurrentImage = Boolean(existingImages[index]?.imgUrl);
    const hasRequestedUrl = Boolean(requestedImage?.imgUrl);

    if (!uploadsByIndex.has(index) && !hasRequestedUrl && !hasCurrentImage) {
      badRequest(`Imagem ${index} do serviço é obrigatória.`);
    }
  }

  const uploadedUrls: string[] = [];
  let uploadedBackground:
    | Awaited<ReturnType<typeof uploadPublicAsset>>
    | null = null;
  let preparedBackground:
    | Awaited<ReturnType<typeof prepareImageAsset>>
    | null = null;
  const uploadedImages = new Map<number, Awaited<ReturnType<typeof uploadPublicAsset>>>();
  const preparedImages = new Map<number, Awaited<ReturnType<typeof prepareImageAsset>>>();

  try {
    if (backgroundUpload) {
      preparedBackground = await prepareImageAsset(backgroundUpload);
      uploadedBackground = await uploadPublicAsset(
        buildServicePageBackgroundImagePath(nextSlug, preparedBackground.originalFilename),
        preparedBackground
      );

      uploadedUrls.push(uploadedBackground.url);
    }

    for (const [index, file] of [...uploadsByIndex.entries()].sort((a, b) => a[0] - b[0])) {
      const preparedImage = await prepareImageAsset(file);
      const uploadedImage = await uploadPublicAsset(
        buildServicePageExampleImagePath(nextSlug, index, preparedImage.originalFilename),
        preparedImage
      );

      preparedImages.set(index, preparedImage);
      uploadedImages.set(index, uploadedImage);
      uploadedUrls.push(uploadedImage.url);
    }
  } catch (error) {
    await cleanupBlobUrls(uploadedUrls);
    throw error;
  }

  const item = servicesPageMutationSchema.parse({
    ...input,
    category: resolveServicePageCategory(content, input.category),
    backgroundImageUrl:
      uploadedBackground?.url ?? input.backgroundImageUrl ?? existingItem?.backgroundImageUrl ?? "",
    images: requestedImages.map((image, index) => ({
      imgUrl:
        uploadedImages.get(index)?.url ??
        image.imgUrl ??
        existingImages[index]?.imgUrl ??
        ""
    }))
  });

  const previousAssets = currentSlug
    ? await prisma.asset.findMany({
        where: getServicePageAssetFilter(currentSlug),
        orderBy: {
          createdAt: "desc"
        }
      })
    : [];
  const previousAssetByUrl = new Map<string, (typeof previousAssets)[number]>();
  const previousImageAssetBySlot = new Map<number, (typeof previousAssets)[number]>();
  let previousBackgroundAsset: (typeof previousAssets)[number] | undefined;

  for (const asset of previousAssets) {
    if (!previousAssetByUrl.has(asset.url)) {
      previousAssetByUrl.set(asset.url, asset);
    }

    if (asset.fieldKey === SERVICE_PAGE_BACKGROUND_FIELD_KEY && !previousBackgroundAsset) {
      previousBackgroundAsset = asset;
    }

    if (
      asset.fieldKey === SERVICE_PAGE_IMAGES_FIELD_KEY &&
      asset.slot !== null &&
      !previousImageAssetBySlot.has(asset.slot)
    ) {
      previousImageAssetBySlot.set(asset.slot, asset);
    }
  }

  const assetsToPersist: Prisma.AssetCreateManyInput[] = [];

  if (uploadedBackground && preparedBackground) {
    assetsToPersist.push({
      kind: "image",
      entityType: SERVICE_PAGE_ASSET_ENTITY_TYPE,
      entityId: item.slug,
      sectionKey: SERVICE_PAGE_ASSET_SECTION_KEY,
      fieldKey: SERVICE_PAGE_BACKGROUND_FIELD_KEY,
      slot: null,
      pathname: uploadedBackground.pathname,
      url: uploadedBackground.url,
      mimeType: preparedBackground.contentType,
      sizeBytes: preparedBackground.sizeBytes,
      originalFilename: preparedBackground.originalFilename,
      alt: null,
      createdById: userId
    });
  } else {
    const retainedBackgroundAsset =
      previousAssetByUrl.get(item.backgroundImageUrl) ?? previousBackgroundAsset;

    if (retainedBackgroundAsset?.url === item.backgroundImageUrl) {
      assetsToPersist.push({
        kind: retainedBackgroundAsset.kind,
        entityType: SERVICE_PAGE_ASSET_ENTITY_TYPE,
        entityId: item.slug,
        sectionKey: SERVICE_PAGE_ASSET_SECTION_KEY,
        fieldKey: SERVICE_PAGE_BACKGROUND_FIELD_KEY,
        slot: null,
        pathname: retainedBackgroundAsset.pathname,
        url: retainedBackgroundAsset.url,
        mimeType: retainedBackgroundAsset.mimeType,
        sizeBytes: retainedBackgroundAsset.sizeBytes,
        originalFilename: retainedBackgroundAsset.originalFilename,
        alt: retainedBackgroundAsset.alt,
        createdById: retainedBackgroundAsset.createdById
      });
    }
  }

  for (const [index, image] of item.images.entries()) {
    const uploadedImage = uploadedImages.get(index);
    const preparedImage = preparedImages.get(index);

    if (uploadedImage && preparedImage) {
      assetsToPersist.push({
        kind: "image",
        entityType: SERVICE_PAGE_ASSET_ENTITY_TYPE,
        entityId: item.slug,
        sectionKey: SERVICE_PAGE_ASSET_SECTION_KEY,
        fieldKey: SERVICE_PAGE_IMAGES_FIELD_KEY,
        slot: index,
        pathname: uploadedImage.pathname,
        url: uploadedImage.url,
        mimeType: preparedImage.contentType,
        sizeBytes: preparedImage.sizeBytes,
        originalFilename: preparedImage.originalFilename,
        alt: null,
        createdById: userId
      });
      continue;
    }

    const retainedImageAsset =
      previousAssetByUrl.get(image.imgUrl) ?? previousImageAssetBySlot.get(index);

    if (retainedImageAsset?.url !== image.imgUrl) {
      continue;
    }

    assetsToPersist.push({
      kind: retainedImageAsset.kind,
      entityType: SERVICE_PAGE_ASSET_ENTITY_TYPE,
      entityId: item.slug,
      sectionKey: SERVICE_PAGE_ASSET_SECTION_KEY,
      fieldKey: SERVICE_PAGE_IMAGES_FIELD_KEY,
      slot: index,
      pathname: retainedImageAsset.pathname,
      url: retainedImageAsset.url,
      mimeType: retainedImageAsset.mimeType,
      sizeBytes: retainedImageAsset.sizeBytes,
      originalFilename: retainedImageAsset.originalFilename,
      alt: retainedImageAsset.alt,
      createdById: retainedImageAsset.createdById
    });
  }

  const nextContent = {
    ...content,
    servicesPages:
      mode === "create"
        ? [...servicesPages, item]
        : servicesPages.map((currentItem) => (currentItem.slug === currentSlug ? item : currentItem))
  } as DraftContent;

  const finalImageUrls = new Set([
    item.backgroundImageUrl,
    ...item.images.map((image) => image.imgUrl)
  ]);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput(nextContent),
          status: "draft",
          updatedById: userId
        }
      });

      if (currentSlug) {
        await tx.asset.deleteMany({
          where: getServicePageAssetFilter(currentSlug)
        });
      }

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

  return item;
}

async function saveOperationSectionContent(
  mode: "create" | "update",
  input: OperationSection | OperationSectionMultipartInput,
  uploadsByIndex: Map<number, File>,
  userId: string
): Promise<OperationSection> {
  const page =
    mode === "create"
      ? await ensureMainDraftPageExists(userId)
      : await getMainPageOrThrow();

  const content = await getMainDraftContent(page);
  const existingOperationSection = content.operationSection;

  if (mode === "create" && existingOperationSection) {
    conflict("Seção de operação já cadastrada.");
  }

  if (mode === "update" && !existingOperationSection) {
    notFound("Seção de operação não encontrada.");
  }

  const currentImages = existingOperationSection?.images ?? [];
  const maxUploadedIndex = uploadsByIndex.size > 0 ? Math.max(...uploadsByIndex.keys()) : -1;
  const targetImageCount = Array.isArray(input.images)
    ? input.images.length
    : mode === "create"
      ? maxUploadedIndex + 1
      : Math.max(currentImages.length, maxUploadedIndex + 1);

  if (targetImageCount < 1) {
    badRequest("Ao menos uma imagem da seção de operação é obrigatória.");
  }

  const requestedImages: Array<{ url?: string; alt?: string }> = Array.isArray(input.images)
    ? input.images
    : Array.from({ length: targetImageCount }, () => ({}));

  for (let index = 0; index < targetImageCount; index += 1) {
    const requestedImage = requestedImages[index];
    const hasCurrentImage = Boolean(currentImages[index]?.url);
    const hasRequestedUrl = Boolean(requestedImage?.url);

    if (!uploadsByIndex.has(index) && !hasRequestedUrl && !hasCurrentImage) {
      badRequest(`Imagem ${index} da seção de operação é obrigatória.`);
    }
  }

  const preparedAssets = new Map<number, Awaited<ReturnType<typeof prepareImageAsset>>>();
  const uploadedAssets = new Map<number, Awaited<ReturnType<typeof uploadPublicAsset>>>();
  const uploadedUrls: string[] = [];

  try {
    for (const [index, file] of [...uploadsByIndex.entries()].sort((a, b) => a[0] - b[0])) {
      const preparedAsset = await prepareImageAsset(file);
      preparedAssets.set(index, preparedAsset);
    }

    for (const [index, preparedAsset] of [...preparedAssets.entries()].sort((a, b) => a[0] - b[0])) {
      const uploadedBlob = await uploadPublicAsset(
        buildOperationSectionImagePath(index, preparedAsset.originalFilename),
        preparedAsset
      );

      uploadedAssets.set(index, uploadedBlob);
      uploadedUrls.push(uploadedBlob.url);
    }
  } catch (error) {
    await cleanupBlobUrls(uploadedUrls);
    throw error;
  }

  const nextOperationSection = operationSectionSchema.parse({
    images: requestedImages.map((image, index) => ({
      url: uploadedAssets.get(index)?.url ?? image.url ?? currentImages[index]?.url ?? "",
      alt: image.alt ?? currentImages[index]?.alt
    }))
  });

  const previousAssets = await prisma.asset.findMany({
    where: OPERATION_SECTION_ASSET_FILTER,
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

  const assetsToPersist: Prisma.AssetCreateManyInput[] = [];

  for (const [index, image] of nextOperationSection.images.entries()) {
    const uploadedBlob = uploadedAssets.get(index);

    if (uploadedBlob) {
      const preparedAsset = preparedAssets.get(index)!;
      const previousAsset = previousAssetBySlot.get(index);

      assetsToPersist.push({
        kind: "image",
        entityType: "landingPage",
        entityId: MAIN_CONTENT_SLUG,
        sectionKey: "operationSection",
        fieldKey: "images",
        slot: index,
        pathname: uploadedBlob.pathname,
        url: uploadedBlob.url,
        mimeType: preparedAsset.contentType,
        sizeBytes: preparedAsset.sizeBytes,
        originalFilename: preparedAsset.originalFilename,
        alt: image.alt ?? previousAsset?.alt ?? null,
        createdById: userId
      });
      continue;
    }

    const retainedAsset = previousAssetByUrl.get(image.url) ?? previousAssetBySlot.get(index);
    if (!retainedAsset || retainedAsset.url !== image.url) {
      continue;
    }

    assetsToPersist.push({
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
      alt: image.alt ?? retainedAsset.alt ?? null,
      createdById: retainedAsset.createdById
    });
  }

  const finalImageUrls = new Set(nextOperationSection.images.map((image) => image.url));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput({
            ...content,
            operationSection: nextOperationSection
          } as DraftContent),
          status: "draft",
          updatedById: userId
        }
      });

      await tx.asset.deleteMany({
        where: OPERATION_SECTION_ASSET_FILTER
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

  return nextOperationSection;
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
  const [page, approvedNpsResponses] = await Promise.all([
    findMainPage(),
    listApprovedNpsResponses()
  ]);

  if (!page || !page.publishedContent) {
    notFound("Conteúdo publicado não encontrado.");
  }

  const publishedContent = sanitizeContentForPublish(page.publishedContent) as PublicContentRecord["content"];

  return {
    content: {
      ...publishedContent,
      npsResponses: approvedNpsResponses
    } as PublicContentRecord["content"],
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
    content: withDerivedScenery(content),
    publishedContent: page.publishedContent
      ? (sanitizeContentForPublish(page.publishedContent) as AdminContentRecord["publishedContent"])
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
    content: withDerivedScenery(content),
    publishedContent: publishedContent as AdminContentRecord["publishedContent"],
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt
  };
}

export async function getScenerySection() {
  const page = await findMainPage();

  if (!page) {
    return buildScenerySection({});
  }

  const content = await getMainDraftContent(page);
  return buildScenerySection(content);
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

export async function createOperationSection(
  input: OperationSection | OperationSectionMultipartInput,
  uploadsByIndex: Map<number, File>,
  userId: string
) {
  return saveOperationSectionContent("create", input, uploadsByIndex, userId);
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

export async function updateOperationSection(
  input: OperationSection | OperationSectionMultipartInput,
  uploadsByIndex: Map<number, File>,
  userId: string
) {
  return saveOperationSectionContent("update", input, uploadsByIndex, userId);
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

export async function deleteHeroSectionSlide(
  slideIndex: number,
  userId: string
): Promise<HeroSection | null> {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const heroSection = content.heroSection;

  if (!heroSection) {
    notFound("Seção hero não encontrada.");
  }

  if (!heroSection[slideIndex]) {
    notFound("Slide da seção hero não encontrado.");
  }

  const nextTopics = heroSection.filter((_, index) => index !== slideIndex);

  if (nextTopics.length === 0) {
    await deleteHeroSection(userId);
    return null;
  }

  const validatedHeroSection = heroSectionSchema.parse(nextTopics);

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

  const assetsToPersist: Prisma.AssetCreateManyInput[] = [];

  for (const [newIndex, topic] of validatedHeroSection.entries()) {
    const sourceIndex = newIndex < slideIndex ? newIndex : newIndex + 1;
    const retainedAsset =
      previousAssetBySlot.get(sourceIndex) ??
      previousAssetByUrl.get(topic.image) ??
      previousAssetBySlot.get(newIndex);

    if (!retainedAsset || retainedAsset.url !== topic.image) {
      badRequest("Inconsistência entre imagens da seção hero e assets registrados.");
    }

    assetsToPersist.push({
      kind: retainedAsset.kind,
      entityType: retainedAsset.entityType,
      entityId: retainedAsset.entityId,
      sectionKey: retainedAsset.sectionKey,
      fieldKey: retainedAsset.fieldKey,
      slot: newIndex,
      pathname: retainedAsset.pathname,
      url: retainedAsset.url,
      mimeType: retainedAsset.mimeType,
      sizeBytes: retainedAsset.sizeBytes,
      originalFilename: retainedAsset.originalFilename,
      alt: retainedAsset.alt,
      createdById: retainedAsset.createdById
    });
  }

  const finalImageUrls = new Set(validatedHeroSection.map((topic) => topic.image));

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

  const previousUrlsToDelete = previousAssets
    .map((asset) => asset.url)
    .filter((url) => !finalImageUrls.has(url));

  await cleanupBlobUrls(previousUrlsToDelete);

  return validatedHeroSection;
}

export async function deleteOperationSection(userId: string) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);

  if (!content.operationSection) {
    notFound("Seção de operação não encontrada.");
  }

  const previousAssets = await prisma.asset.findMany({
    where: OPERATION_SECTION_ASSET_FILTER,
    orderBy: {
      createdAt: "desc"
    }
  });

  const nextContent = { ...content };
  delete nextContent.operationSection;

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
      where: OPERATION_SECTION_ASSET_FILTER
    });
  });

  await cleanupBlobUrls(previousAssets.map((asset) => asset.url));
}

export async function deleteOperationSectionImage(imageIndex: number, userId: string) {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const operationSection = content.operationSection;

  if (!operationSection) {
    notFound("Seção de operação não encontrada.");
  }

  if (!operationSection.images[imageIndex]) {
    notFound("Imagem da seção de operação não encontrada.");
  }

  if (operationSection.images.length <= 1) {
    badRequest("A seção de operação precisa manter ao menos uma imagem.");
  }

  const nextOperationSection = operationSectionSchema.parse({
    images: operationSection.images.filter((_, index) => index !== imageIndex)
  });

  const previousAssets = await prisma.asset.findMany({
    where: OPERATION_SECTION_ASSET_FILTER,
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

  const assetsToPersist: Prisma.AssetCreateManyInput[] = [];

  for (const [index, image] of nextOperationSection.images.entries()) {
    const sourceSlot = index >= imageIndex ? index + 1 : index;
    const retainedAsset =
      previousAssetBySlot.get(sourceSlot) ??
      previousAssetByUrl.get(image.url) ??
      previousAssetBySlot.get(index);

    if (!retainedAsset || retainedAsset.url !== image.url) {
      continue;
    }

    assetsToPersist.push({
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
      alt: image.alt ?? retainedAsset.alt ?? null,
      createdById: retainedAsset.createdById
    });
  }

  const finalImageUrls = new Set(nextOperationSection.images.map((image) => image.url));

  await prisma.$transaction(async (tx) => {
    await tx.landingPage.update({
      where: { id: page.id },
      data: {
        draftContent: toDraftContentInput({
          ...content,
          operationSection: nextOperationSection
        } as DraftContent),
        status: "draft",
        updatedById: userId
      }
    });

    await tx.asset.deleteMany({
      where: OPERATION_SECTION_ASSET_FILTER
    });

    if (assetsToPersist.length > 0) {
      await tx.asset.createMany({
        data: assetsToPersist
      });
    }
  });

  const previousUrlsToDelete = previousAssets
    .map((asset) => asset.url)
    .filter((url) => !finalImageUrls.has(url));

  await cleanupBlobUrls(previousUrlsToDelete);

  return nextOperationSection;
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

  if (isCategoriesCollection(config)) {
    assertCategorySlugAvailable(content, String(input.slug ?? ""));
  }

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
  input: ServicesPageItem | ServicePageMultipartInput,
  backgroundUpload: File | null,
  uploadsByIndex: Map<number, File>,
  userId: string
) {
  return saveServicePageContent("create", null, input, backgroundUpload, uploadsByIndex, userId);
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

  if (isCategoriesCollection(config)) {
    assertCategorySlugAvailable(content, String(input.slug ?? ""), itemId);
  }

  const updatedItem = {
    ...input,
    id: itemId
  };

  const nextServicesPages = isCategoriesCollection(config)
    ? syncServicesPagesWithCategory(
        getServicesPages(content),
        item as DraftCategory,
        updatedItem as DraftCategory
      )
    : null;

  const nextContent = (
    isCategoriesCollection(config)
      ? {
          ...content,
          servicesPages: nextServicesPages ?? getServicesPages(content),
          [config.key]: items.map((currentItem) =>
            currentItem.id === itemId ? updatedItem : currentItem
          )
        }
      : {
          ...content,
          [config.key]: items.map((currentItem) =>
            currentItem.id === itemId ? updatedItem : currentItem
          )
        }
  ) as DraftContent;

  await saveMainDraftContent(page.id, nextContent, userId);

  return updatedItem;
}

export async function updateServicePage(
  currentSlug: string,
  input: ServicesPageItem | ServicePageMultipartInput,
  backgroundUpload: File | null,
  uploadsByIndex: Map<number, File>,
  userId: string
) {
  return saveServicePageContent(
    "update",
    currentSlug,
    input,
    backgroundUpload,
    uploadsByIndex,
    userId
  );
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

  if (isCategoriesCollection(config)) {
    assertCategoryCanBeDeleted(content, itemId);
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

  const previousAssets = await prisma.asset.findMany({
    where: getServicePageAssetFilter(slug),
    orderBy: {
      createdAt: "desc"
    }
  });

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
      where: getServicePageAssetFilter(slug)
    });
  });

  await cleanupBlobUrls(previousAssets.map((asset) => asset.url));
}

function getClients(content: DraftContent): DraftClientItem[] {
  return Array.isArray(content.clients) ? content.clients : [];
}

function ensureClientsCollectionIds(content: DraftContent): {
  content: DraftContent;
  changed: boolean;
  items: DraftClientItem[];
} {
  const rawItems = getClients(content);

  if (rawItems.length === 0) {
    return { content, changed: false, items: [] };
  }

  let changed = false;
  const items = rawItems.map((item) => {
    if (item.id) {
      return item;
    }

    changed = true;
    return { ...item, id: randomUUID() };
  });

  if (!changed) {
    return { content, changed: false, items };
  }

  return {
    content: { ...content, clients: items } as DraftContent,
    changed: true,
    items
  };
}

export async function listClients(): Promise<DraftClientItem[]> {
  const page = await findMainPage();

  if (!page) {
    return [];
  }

  const content = await getMainDraftContent(page);
  return ensureClientsCollectionIds(content).items;
}

export async function listPublishedClients(): Promise<DraftClientItem[]> {
  const page = await findMainPage();

  if (!page || !page.publishedContent) {
    return [];
  }

  const publishedContent = page.publishedContent as Record<string, unknown>;
  const rawClients = publishedContent.clients;

  if (!Array.isArray(rawClients)) {
    return [];
  }

  const items: DraftClientItem[] = [];

  for (const raw of rawClients) {
    const parsed = clientItemSchema.safeParse(raw);

    if (parsed.success) {
      const withId = raw as { id?: unknown };
      items.push({
        ...parsed.data,
        id: typeof withId.id === "string" ? withId.id : undefined
      });
    }
  }

  return items;
}

export async function getClient(clientId: string): Promise<DraftClientItem> {
  const clients = await listClients();
  const client = clients.find((currentItem) => currentItem.id === clientId);

  if (!client) {
    notFound("Cliente não encontrado.");
  }

  return client;
}

export async function createClient(
  input: ClientItemInput,
  logoUpload: File | null,
  userId: string
): Promise<DraftClientItem> {
  if (!logoUpload) {
    badRequest("Logo do cliente é obrigatório.");
  }

  const page = await ensureMainDraftPageExists(userId);
  const content = await getMainDraftContent(page);
  const clients = ensureClientsCollectionIds(content).items;
  const clientId = randomUUID();

  const preparedLogo = await prepareClientLogoAsset(logoUpload, CLIENT_LOGO_MAX_BYTES);
  const uploadedLogo = await uploadPublicAsset(
    buildClientLogoPath(clientId, preparedLogo.originalFilename),
    preparedLogo
  );

  const item = clientItemSchema.parse({
    name: input.name,
    alt: input.alt,
    website: input.website,
    logoUrl: uploadedLogo.url
  });

  const draftItem: DraftClientItem = { ...item, id: clientId };

  const nextContent = {
    ...content,
    clients: [...clients, draftItem]
  } as DraftContent;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput(nextContent),
          status: "draft",
          updatedById: userId
        }
      });

      await tx.asset.create({
        data: {
          kind: "image",
          entityType: "landingPage",
          entityId: MAIN_CONTENT_SLUG,
          sectionKey: "clients",
          fieldKey: "logoUrl",
          slot: null,
          pathname: uploadedLogo.pathname,
          url: uploadedLogo.url,
          mimeType: preparedLogo.contentType,
          sizeBytes: preparedLogo.sizeBytes,
          originalFilename: preparedLogo.originalFilename,
          alt: item.alt,
          createdById: userId
        }
      });
    });
  } catch (error) {
    await cleanupBlobUrls([uploadedLogo.url]);
    throw error;
  }

  return draftItem;
}

export async function updateClient(
  clientId: string,
  input: ClientItemInput,
  logoUpload: File | null,
  userId: string
): Promise<DraftClientItem> {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const clients = ensureClientsCollectionIds(content).items;
  const existingItem = clients.find((currentItem) => currentItem.id === clientId);

  if (!existingItem) {
    notFound("Cliente não encontrado.");
  }

  let uploadedLogoUrl: string | null = null;
  let preparedLogo: Awaited<ReturnType<typeof prepareClientLogoAsset>> | null = null;
  let uploadedLogo: Awaited<ReturnType<typeof uploadPublicAsset>> | null = null;
  const previousLogoUrl = existingItem.logoUrl;

  if (logoUpload) {
    preparedLogo = await prepareClientLogoAsset(logoUpload, CLIENT_LOGO_MAX_BYTES);
    uploadedLogo = await uploadPublicAsset(
      buildClientLogoPath(clientId, preparedLogo.originalFilename),
      preparedLogo
    );
    uploadedLogoUrl = uploadedLogo.url;
  }

  const nextLogoUrl = uploadedLogoUrl ?? input.logoUrl ?? previousLogoUrl;

  const item = clientItemSchema.parse({
    name: input.name,
    alt: input.alt,
    website: input.website,
    logoUrl: nextLogoUrl
  });

  const updatedItem: DraftClientItem = { ...item, id: clientId };

  const nextContent = {
    ...content,
    clients: clients.map((currentItem) =>
      currentItem.id === clientId ? updatedItem : currentItem
    )
  } as DraftContent;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.landingPage.update({
        where: { id: page.id },
        data: {
          draftContent: toDraftContentInput(nextContent),
          status: "draft",
          updatedById: userId
        }
      });

      if (uploadedLogo && preparedLogo) {
        await tx.asset.deleteMany({
          where: { ...CLIENTS_ASSET_FILTER, url: previousLogoUrl }
        });

        await tx.asset.create({
          data: {
            kind: "image",
            entityType: "landingPage",
            entityId: MAIN_CONTENT_SLUG,
            sectionKey: "clients",
            fieldKey: "logoUrl",
            slot: null,
            pathname: uploadedLogo.pathname,
            url: uploadedLogo.url,
            mimeType: preparedLogo.contentType,
            sizeBytes: preparedLogo.sizeBytes,
            originalFilename: preparedLogo.originalFilename,
            alt: item.alt,
            createdById: userId
          }
        });
      } else {
        await tx.asset.updateMany({
          where: { ...CLIENTS_ASSET_FILTER, url: nextLogoUrl },
          data: { alt: item.alt }
        });
      }
    });
  } catch (error) {
    if (uploadedLogoUrl) {
      await cleanupBlobUrls([uploadedLogoUrl]);
    }
    throw error;
  }

  if (uploadedLogoUrl && previousLogoUrl && previousLogoUrl !== uploadedLogoUrl) {
    await cleanupBlobUrls([previousLogoUrl]);
  }

  return updatedItem;
}

export async function deleteClient(clientId: string, userId: string): Promise<void> {
  const page = await getMainPageOrThrow();
  const content = await getMainDraftContent(page);
  const clients = ensureClientsCollectionIds(content).items;
  const existingItem = clients.find((currentItem) => currentItem.id === clientId);

  if (!existingItem) {
    notFound("Cliente não encontrado.");
  }

  const previousLogoUrl = existingItem.logoUrl;

  const nextContent = {
    ...content,
    clients: clients.filter((currentItem) => currentItem.id !== clientId)
  } as DraftContent;

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
      where: { ...CLIENTS_ASSET_FILTER, url: previousLogoUrl }
    });
  });

  await cleanupBlobUrls([previousLogoUrl]);
}
