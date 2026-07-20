import { badRequest, internalServerError, notFound, unauthorized } from "../../lib/http.js";
import { decodeAccessToken } from "../../lib/auth.js";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import { validateCategorySlug } from "../content/content.utils.js";
import { DOCUMENT_ENTITY_TYPE } from "../translation/translation.config.js";
import {
  enqueueDocumentTranslations,
  localizeDocuments,
  processEntityTranslations,
  runTranslationsInBackground
} from "../translation/translation.service.js";
import type { ContentLocale, TargetLocale } from "../translation/translation.types.js";
import { SOURCE_LOCALE } from "../translation/translation.types.js";
import {
  resolveDocumentDbLocale,
  toContentLocale,
  toDocumentLocale
} from "./documents.locale.js";
import type {
  CreateDocumentInput,
  DocumentAdminListItem,
  DocumentPublicDto,
  DocumentRecord,
  PersistDocumentFileInput,
  UpdateDocumentInput
} from "./documents.types.js";

const documentSelect = {
  id: true,
  title: true,
  titleEn: true,
  titleEs: true,
  description: true,
  descriptionEn: true,
  descriptionEs: true,
  categorySlug: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  files: {
    select: {
      id: true,
      locale: true,
      url: true,
      pathname: true,
      mimeType: true,
      sizeBytes: true,
      originalFilename: true,
      coverImageUrl: true,
      coverImagePathname: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { locale: "asc" as const }
  }
} as const;

function availableLocalesFromFiles(
  files: Array<{ locale: DocumentRecord["files"][number]["locale"] }>
): ContentLocale[] {
  const present = new Set(files.map((file) => toContentLocale(file.locale)));
  const ordered: ContentLocale[] = [SOURCE_LOCALE, "en", "es"];
  return ordered.filter((locale) => present.has(locale));
}

function toAdminListItem(record: DocumentRecord): DocumentAdminListItem {
  return {
    ...record,
    availableLocales: availableLocalesFromFiles(record.files)
  };
}

async function getDocumentOrThrow(id: string): Promise<DocumentRecord> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: documentSelect
  });

  if (!document) {
    notFound("Documento não encontrado.");
  }

  return document;
}

export async function listAdminDocuments(): Promise<DocumentAdminListItem[]> {
  const documents = await prisma.document.findMany({
    select: documentSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }]
  });

  return documents.map(toAdminListItem);
}

export async function getAdminDocument(id: string): Promise<DocumentAdminListItem> {
  return toAdminListItem(await getDocumentOrThrow(id));
}

export async function createDocument(
  input: CreateDocumentInput,
  userId: string
): Promise<DocumentAdminListItem> {
  await validateCategorySlug(input.categorySlug);

  const document = await prisma.document.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      titleEn: input.titleEn ?? null,
      titleEs: input.titleEs ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionEs: input.descriptionEs ?? null,
      categorySlug: input.categorySlug,
      order: input.order,
      createdById: userId
    },
    select: documentSelect
  });

  await enqueueDocumentTranslations(document);
  runTranslationsInBackground(
    processEntityTranslations(DOCUMENT_ENTITY_TYPE, document.id)
  );

  return toAdminListItem(document);
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput
): Promise<DocumentAdminListItem> {
  await getDocumentOrThrow(id);

  if (input.categorySlug) {
    await validateCategorySlug(input.categorySlug);
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.titleEn !== undefined ? { titleEn: input.titleEn } : {}),
      ...(input.titleEs !== undefined ? { titleEs: input.titleEs } : {}),
      ...(input.descriptionEn !== undefined
        ? { descriptionEn: input.descriptionEn }
        : {}),
      ...(input.descriptionEs !== undefined
        ? { descriptionEs: input.descriptionEs }
        : {}),
      ...(input.categorySlug !== undefined ? { categorySlug: input.categorySlug } : {}),
      ...(input.order !== undefined ? { order: input.order } : {})
    },
    select: documentSelect
  });

  await enqueueDocumentTranslations(document);
  runTranslationsInBackground(
    processEntityTranslations(DOCUMENT_ENTITY_TYPE, document.id)
  );

  return toAdminListItem(document);
}

export async function deleteDocument(id: string): Promise<void> {
  const document = await getDocumentOrThrow(id);

  for (const file of document.files) {
    await deleteBlobAsset(file.url).catch(() => {});
    if (file.coverImageUrl) {
      await deleteBlobAsset(file.coverImageUrl).catch(() => {});
    }
  }

  await prisma.document.delete({ where: { id } });

  await prisma.translation.deleteMany({
    where: { entityType: DOCUMENT_ENTITY_TYPE, entityId: id }
  });
}

export async function persistDocumentFile(
  documentId: string,
  locale: ContentLocale,
  input: PersistDocumentFileInput
): Promise<DocumentAdminListItem> {
  await getDocumentOrThrow(documentId);

  if (input.mimeType !== "application/pdf") {
    badRequest("Apenas arquivos PDF são aceitos.");
  }

  if (input.sizeBytes > env.DOCUMENT_MAX_UPLOAD_BYTES) {
    badRequest(
      `Arquivo maior do que o permitido. Limite: ${env.DOCUMENT_MAX_UPLOAD_BYTES} bytes.`
    );
  }

  if (!input.pathname.startsWith(`documents/${documentId}/`)) {
    badRequest("Pathname do arquivo inválido para este documento.");
  }

  const dbLocale = toDocumentLocale(locale);
  const existing = await prisma.documentFile.findUnique({
    where: {
      documentId_locale: { documentId, locale: dbLocale }
    }
  });

  if (existing && existing.url !== input.url) {
    await deleteBlobAsset(existing.url).catch(() => {});
  }

  await prisma.documentFile.upsert({
    where: {
      documentId_locale: { documentId, locale: dbLocale }
    },
    create: {
      documentId,
      locale: dbLocale,
      url: input.url,
      pathname: input.pathname,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename ?? null
    },
    update: {
      url: input.url,
      pathname: input.pathname,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename ?? null
    }
  });

  return toAdminListItem(await getDocumentOrThrow(documentId));
}

export async function deleteDocumentFile(
  documentId: string,
  locale: ContentLocale
): Promise<DocumentAdminListItem> {
  await getDocumentOrThrow(documentId);

  const dbLocale = toDocumentLocale(locale);
  const existing = await prisma.documentFile.findUnique({
    where: {
      documentId_locale: { documentId, locale: dbLocale }
    }
  });

  if (!existing) {
    notFound("Arquivo do documento não encontrado para este idioma.");
  }

  await deleteBlobAsset(existing.url).catch(() => {});
  if (existing.coverImageUrl) {
    await deleteBlobAsset(existing.coverImageUrl).catch(() => {});
  }
  await prisma.documentFile.delete({
    where: { id: existing.id }
  });

  return toAdminListItem(await getDocumentOrThrow(documentId));
}

export async function uploadDocumentCover(
  documentId: string,
  locale: ContentLocale,
  file: File
): Promise<DocumentAdminListItem> {
  const dbLocale = toDocumentLocale(locale);
  const existing = await prisma.documentFile.findUnique({
    where: {
      documentId_locale: { documentId, locale: dbLocale }
    }
  });

  if (!existing) {
    badRequest("Envie o PDF deste idioma antes da imagem de capa.");
  }

  if (existing.coverImageUrl) {
    await deleteBlobAsset(existing.coverImageUrl).catch(() => {});
  }

  const prepared = await prepareImageAsset(file);
  const localeKey = locale === "pt-BR" ? "pt-BR" : locale;
  const pathname = `documents/${documentId}/${localeKey}/cover.webp`;
  const blob = await uploadPublicAsset(pathname, prepared);

  await prisma.documentFile.update({
    where: { id: existing.id },
    data: {
      coverImageUrl: blob.url,
      coverImagePathname: pathname
    }
  });

  return toAdminListItem(await getDocumentOrThrow(documentId));
}

export async function deleteDocumentCover(
  documentId: string,
  locale: ContentLocale
): Promise<DocumentAdminListItem> {
  const dbLocale = toDocumentLocale(locale);
  const existing = await prisma.documentFile.findUnique({
    where: {
      documentId_locale: { documentId, locale: dbLocale }
    }
  });

  if (!existing) {
    notFound("Arquivo do documento não encontrado para este idioma.");
  }

  if (!existing.coverImageUrl) {
    notFound("Imagem de capa não encontrada para este idioma.");
  }

  await deleteBlobAsset(existing.coverImageUrl).catch(() => {});

  await prisma.documentFile.update({
    where: { id: existing.id },
    data: {
      coverImageUrl: null,
      coverImagePathname: null
    }
  });

  return toAdminListItem(await getDocumentOrThrow(documentId));
}

export async function listPublicDocuments(options: {
  locale: TargetLocale | null;
  categorySlug?: string;
}): Promise<DocumentPublicDto[]> {
  const dbLocale = resolveDocumentDbLocale(options.locale);

  const documents = await prisma.document.findMany({
    where: {
      ...(options.categorySlug ? { categorySlug: options.categorySlug } : {}),
      files: { some: { locale: dbLocale } }
    },
    select: documentSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }]
  });

  const localized = await localizeDocuments(documents, options.locale);

  return localized.flatMap((document) => {
    const file = document.files.find((entry) => entry.locale === dbLocale);
    if (!file) {
      return [];
    }

    return [
      {
        id: document.id,
        title: document.title,
        description: document.description,
        categorySlug: document.categorySlug,
        order: document.order,
        coverImageUrl: file.coverImageUrl,
        file: {
          url: file.url,
          originalFilename: file.originalFilename,
          sizeBytes: file.sizeBytes
        }
      }
    ];
  });
}

export async function assertAuthenticatedUserFromToken(token: string) {
  let payload;
  try {
    payload = await decodeAccessToken(token);
  } catch {
    unauthorized("Token inválido ou expirado.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    unauthorized("Usuário inválido ou inativo.");
  }

  if (user.role !== "MASTER" && user.role !== "ADMIN") {
    unauthorized("Sem permissão para enviar documentos.");
  }

  return user;
}

export function ensureBlobConfigured(): string {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    internalServerError("Upload de documentos não configurado.");
  }

  return env.BLOB_READ_WRITE_TOKEN;
}

export function buildDocumentBlobPathname(
  documentId: string,
  locale: ContentLocale,
  originalFilename: string
): string {
  const safeName = originalFilename
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  const filename = safeName.endsWith(".pdf") ? safeName : `${safeName || "document"}.pdf`;
  const localeKey = locale === "pt-BR" ? "pt-BR" : locale;

  return `documents/${documentId}/${localeKey}/${Date.now()}-${filename}`;
}
