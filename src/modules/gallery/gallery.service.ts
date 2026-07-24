import type { GalleryMediaKind, Prisma } from "@prisma/client";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import { buildTimestampedGalleryPhotoPath } from "../assets/assets.utils.js";
import { validateCategorySlug } from "../content/content.utils.js";
import { getYouTubeVideoId } from "../content/content.youtube.js";
import { GALLERY_MEDIA_ENTITY_TYPE } from "../translation/translation.config.js";
import {
  enqueueGalleryMediaTranslations,
  localizeGalleryMediaItems,
  processEntityTranslations,
  runTranslationsInBackground
} from "../translation/translation.service.js";
import type { TargetLocale } from "../translation/translation.types.js";
import {
  GALLERY_MEDIA_ASSET_ENTITY_TYPE,
  GALLERY_MEDIA_ASSET_FIELD_KEY,
  GALLERY_MEDIA_ASSET_KIND
} from "./gallery.constants.js";
import {
  MAX_GALLERY_PHOTOS,
  MAX_GALLERY_VIDEOS
} from "./gallery.schemas.js";
import type {
  CreateGalleryVideoInput,
  GalleryMediaItemRecord,
  UpdateGalleryMediaItemInput
} from "./gallery.types.js";

const galleryMediaItemSelect = {
  id: true,
  kind: true,
  alt: true,
  caption: true,
  categorySlug: true,
  order: true,
  imageUrl: true,
  imagePathname: true,
  imageMimeType: true,
  imageSizeBytes: true,
  imageOriginalFilename: true,
  youtubeUrl: true,
  createdAt: true,
  updatedAt: true,
  createdById: true
} as const;

type ListGalleryOptions = {
  kind?: GalleryMediaKind;
  categorySlug?: string;
  locale?: TargetLocale | null;
};

async function scheduleGalleryMediaTranslations(item: GalleryMediaItemRecord): Promise<void> {
  await enqueueGalleryMediaTranslations(item);
  runTranslationsInBackground(
    processEntityTranslations(GALLERY_MEDIA_ENTITY_TYPE, item.id)
  );
}

async function cleanupBlobUrls(urls: string[]) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await deleteBlobAsset(url);
      } catch (error) {
        console.error("Failed to delete gallery blob asset", { url, error });
      }
    })
  );
}

async function urlsStillReferenced(urls: string[], excludingItemId?: string): Promise<Set<string>> {
  if (urls.length === 0) {
    return new Set();
  }

  const [assetHits, itemHits] = await Promise.all([
    prisma.asset.findMany({
      where: { url: { in: urls } },
      select: { url: true, entityType: true, entityId: true }
    }),
    prisma.galleryMediaItem.findMany({
      where: {
        imageUrl: { in: urls },
        ...(excludingItemId ? { id: { not: excludingItemId } } : {})
      },
      select: { imageUrl: true }
    })
  ]);

  const referenced = new Set<string>();

  for (const hit of assetHits) {
    if (
      excludingItemId &&
      hit.entityType === GALLERY_MEDIA_ASSET_ENTITY_TYPE &&
      hit.entityId === excludingItemId
    ) {
      continue;
    }
    referenced.add(hit.url);
  }

  for (const hit of itemHits) {
    if (hit.imageUrl) {
      referenced.add(hit.imageUrl);
    }
  }

  return referenced;
}

async function deleteUnreferencedBlobUrls(urls: string[], excludingItemId?: string) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) {
    return;
  }

  const referenced = await urlsStillReferenced(uniqueUrls, excludingItemId);
  const deletable = uniqueUrls.filter((url) => !referenced.has(url));
  await cleanupBlobUrls(deletable);
}

async function getItemOrThrow(id: string): Promise<GalleryMediaItemRecord> {
  const item = await prisma.galleryMediaItem.findUnique({
    where: { id },
    select: galleryMediaItemSelect
  });

  if (!item) {
    notFound("Item da Galeria não encontrado.");
  }

  return item;
}

async function assertKindCapacity(kind: GalleryMediaKind): Promise<void> {
  const count = await prisma.galleryMediaItem.count({ where: { kind } });
  const limit = kind === "photo" ? MAX_GALLERY_PHOTOS : MAX_GALLERY_VIDEOS;

  if (count >= limit) {
    conflict(
      kind === "photo"
        ? `A Galeria aceita no máximo ${MAX_GALLERY_PHOTOS} fotos.`
        : `A Galeria aceita no máximo ${MAX_GALLERY_VIDEOS} vídeos.`
    );
  }
}

async function resolveNextOrder(kind: GalleryMediaKind, explicitOrder?: number): Promise<number> {
  if (explicitOrder !== undefined) {
    return explicitOrder;
  }

  const latest = await prisma.galleryMediaItem.findFirst({
    where: { kind },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return latest ? latest.order + 1 : 0;
}

async function validateOptionalCategorySlug(categorySlug: string | null | undefined) {
  if (categorySlug === undefined || categorySlug === null) {
    return;
  }

  await validateCategorySlug(categorySlug);
}

function assertCaptionDiffersFromAlt(alt: string, caption: string | null | undefined) {
  if (typeof caption === "string" && caption === alt) {
    badRequest("A legenda deve ser diferente do texto alternativo.");
  }
}

async function upsertPhotoAsset(params: {
  itemId: string;
  userId: string;
  url: string;
  pathname: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string | null;
  alt: string;
}) {
  const existing = await prisma.asset.findFirst({
    where: {
      entityType: GALLERY_MEDIA_ASSET_ENTITY_TYPE,
      entityId: params.itemId,
      fieldKey: GALLERY_MEDIA_ASSET_FIELD_KEY
    },
    select: { id: true }
  });

  const data = {
    kind: GALLERY_MEDIA_ASSET_KIND,
    entityType: GALLERY_MEDIA_ASSET_ENTITY_TYPE,
    entityId: params.itemId,
    sectionKey: null,
    fieldKey: GALLERY_MEDIA_ASSET_FIELD_KEY,
    slot: 0,
    pathname: params.pathname,
    url: params.url,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    originalFilename: params.originalFilename,
    alt: params.alt,
    createdById: params.userId
  };

  if (existing) {
    await prisma.asset.update({
      where: { id: existing.id },
      data: {
        pathname: data.pathname,
        url: data.url,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        originalFilename: data.originalFilename,
        alt: data.alt
      }
    });
    return;
  }

  await prisma.asset.create({ data });
}

async function deletePhotoAssets(itemId: string) {
  await prisma.asset.deleteMany({
    where: {
      entityType: GALLERY_MEDIA_ASSET_ENTITY_TYPE,
      entityId: itemId
    }
  });
}

async function listGalleryMediaItems(
  options: Omit<ListGalleryOptions, "locale"> = {}
): Promise<GalleryMediaItemRecord[]> {
  const where: Prisma.GalleryMediaItemWhereInput = {};

  if (options.kind) {
    where.kind = options.kind;
  }

  if (options.categorySlug) {
    where.categorySlug = options.categorySlug;
  }

  return prisma.galleryMediaItem.findMany({
    where,
    select: galleryMediaItemSelect,
    orderBy: [{ kind: "asc" }, { order: "asc" }, { createdAt: "asc" }]
  });
}

export async function listPublicGalleryMediaItems(
  options: ListGalleryOptions = {}
): Promise<GalleryMediaItemRecord[]> {
  const items = await listGalleryMediaItems(options);
  return localizeGalleryMediaItems(items, options.locale ?? null);
}

export async function listAdminGalleryMediaItems(
  options: Omit<ListGalleryOptions, "locale"> = {}
): Promise<GalleryMediaItemRecord[]> {
  return listGalleryMediaItems(options);
}

export async function getAdminGalleryMediaItem(id: string): Promise<GalleryMediaItemRecord> {
  return getItemOrThrow(id);
}

export async function createGalleryVideo(
  input: CreateGalleryVideoInput,
  userId: string
): Promise<GalleryMediaItemRecord> {
  await assertKindCapacity("video");
  await validateOptionalCategorySlug(input.categorySlug);
  assertCaptionDiffersFromAlt(input.alt, input.caption);

  if (getYouTubeVideoId(input.youtubeUrl) === null) {
    badRequest("Informe uma URL válida do YouTube.");
  }

  const order = await resolveNextOrder("video", input.order);

  const item = await prisma.galleryMediaItem.create({
    data: {
      kind: "video",
      alt: input.alt,
      caption: input.caption ?? null,
      categorySlug: input.categorySlug ?? null,
      order,
      youtubeUrl: input.youtubeUrl.trim(),
      createdById: userId
    },
    select: galleryMediaItemSelect
  });

  await scheduleGalleryMediaTranslations(item);
  return item;
}

export async function createGalleryPhoto(params: {
  file: File;
  alt: string;
  caption?: string;
  categorySlug?: string | null;
  order?: number;
  userId: string;
}): Promise<GalleryMediaItemRecord> {
  await assertKindCapacity("photo");
  await validateOptionalCategorySlug(params.categorySlug);
  assertCaptionDiffersFromAlt(params.alt, params.caption);

  const order = await resolveNextOrder("photo", params.order);
  const prepared = await prepareImageAsset(params.file);
  const pathname = buildTimestampedGalleryPhotoPath(params.file.name);
  const uploaded = await uploadPublicAsset(pathname, prepared);

  try {
    const item = await prisma.galleryMediaItem.create({
      data: {
        kind: "photo",
        alt: params.alt,
        caption: params.caption ?? null,
        categorySlug: params.categorySlug ?? null,
        order,
        imageUrl: uploaded.url,
        imagePathname: pathname,
        imageMimeType: prepared.contentType,
        imageSizeBytes: prepared.sizeBytes,
        imageOriginalFilename: prepared.originalFilename,
        createdById: params.userId
      },
      select: galleryMediaItemSelect
    });

    await upsertPhotoAsset({
      itemId: item.id,
      userId: params.userId,
      url: uploaded.url,
      pathname,
      mimeType: prepared.contentType,
      sizeBytes: prepared.sizeBytes,
      originalFilename: prepared.originalFilename,
      alt: params.alt
    });

    await scheduleGalleryMediaTranslations(item);
    return item;
  } catch (error) {
    await cleanupBlobUrls([uploaded.url]);
    throw error;
  }
}

export async function updateGalleryMediaItem(
  id: string,
  input: UpdateGalleryMediaItemInput
): Promise<GalleryMediaItemRecord> {
  const existing = await getItemOrThrow(id);

  if (input.youtubeUrl !== undefined && existing.kind !== "video") {
    badRequest("Somente vídeos da Galeria aceitam URL do YouTube.");
  }

  if (input.categorySlug !== undefined) {
    await validateOptionalCategorySlug(input.categorySlug);
  }

  const nextAlt = input.alt ?? existing.alt;
  const nextCaption =
    input.caption === undefined ? existing.caption : input.caption === null ? null : input.caption;
  assertCaptionDiffersFromAlt(nextAlt, nextCaption);

  const textsChanged =
    (input.alt !== undefined && input.alt !== existing.alt) ||
    (input.caption !== undefined && nextCaption !== existing.caption);

  const item = await prisma.galleryMediaItem.update({
    where: { id },
    data: {
      ...(input.alt !== undefined ? { alt: input.alt } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.categorySlug !== undefined ? { categorySlug: input.categorySlug } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.youtubeUrl !== undefined ? { youtubeUrl: input.youtubeUrl.trim() } : {})
    },
    select: galleryMediaItemSelect
  });

  if (textsChanged) {
    await scheduleGalleryMediaTranslations(item);
  }

  return item;
}

export async function replaceGalleryPhoto(
  id: string,
  file: File,
  userId: string
): Promise<GalleryMediaItemRecord> {
  const existing = await getItemOrThrow(id);

  if (existing.kind !== "photo") {
    badRequest("Somente fotos da Galeria aceitam substituição de imagem.");
  }

  const previousUrl = existing.imageUrl;
  const prepared = await prepareImageAsset(file);
  const pathname = buildTimestampedGalleryPhotoPath(file.name);
  const uploaded = await uploadPublicAsset(pathname, prepared);

  try {
    const item = await prisma.galleryMediaItem.update({
      where: { id },
      data: {
        imageUrl: uploaded.url,
        imagePathname: pathname,
        imageMimeType: prepared.contentType,
        imageSizeBytes: prepared.sizeBytes,
        imageOriginalFilename: prepared.originalFilename
      },
      select: galleryMediaItemSelect
    });

    await upsertPhotoAsset({
      itemId: item.id,
      userId,
      url: uploaded.url,
      pathname,
      mimeType: prepared.contentType,
      sizeBytes: prepared.sizeBytes,
      originalFilename: prepared.originalFilename,
      alt: item.alt
    });

    if (previousUrl && previousUrl !== uploaded.url) {
      await deleteUnreferencedBlobUrls([previousUrl], id);
    }

    return item;
  } catch (error) {
    await cleanupBlobUrls([uploaded.url]);
    throw error;
  }
}

export async function reorderGalleryMediaItems(params: {
  kind: GalleryMediaKind;
  orderedIds: string[];
}): Promise<GalleryMediaItemRecord[]> {
  const items = await prisma.galleryMediaItem.findMany({
    where: { kind: params.kind },
    select: { id: true }
  });

  const existingIds = new Set(items.map((item) => item.id));
  if (existingIds.size !== params.orderedIds.length) {
    badRequest("A reordenação deve incluir todos os itens do tipo.");
  }

  for (const id of params.orderedIds) {
    if (!existingIds.has(id)) {
      badRequest("A reordenação contém um item inválido para este tipo.");
    }
  }

  const uniqueIds = new Set(params.orderedIds);
  if (uniqueIds.size !== params.orderedIds.length) {
    badRequest("A reordenação não pode repetir itens.");
  }

  await prisma.$transaction(
    params.orderedIds.map((id, index) =>
      prisma.galleryMediaItem.update({
        where: { id },
        data: { order: index }
      })
    )
  );

  return listAdminGalleryMediaItems({ kind: params.kind });
}

export async function deleteGalleryMediaItem(id: string): Promise<void> {
  const existing = await getItemOrThrow(id);
  const imageUrl = existing.imageUrl;

  await deletePhotoAssets(id);
  await prisma.galleryMediaItem.delete({ where: { id } });
  await prisma.translation.deleteMany({
    where: { entityType: GALLERY_MEDIA_ENTITY_TYPE, entityId: id }
  });

  if (imageUrl) {
    await deleteUnreferencedBlobUrls([imageUrl]);
  }
}
