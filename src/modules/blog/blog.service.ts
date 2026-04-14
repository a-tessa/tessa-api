import { badRequest, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  deleteBlobAsset,
  prepareImageAsset,
  uploadPublicAsset
} from "../assets/assets.service.js";
import type {
  BlogArticleListItem,
  BlogArticleRecord,
  BlogArticlesListResult,
  BlogListQuery,
  CreateBlogArticleInput,
  UpdateBlogArticleInput
} from "./blog.types.js";

const articleSelect = {
  id: true,
  title: true,
  slug: true,
  content: true,
  categorySlug: true,
  headerImageUrl: true,
  headerImageAlt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } }
} as const;

const articleListSelect = {
  id: true,
  title: true,
  slug: true,
  categorySlug: true,
  headerImageUrl: true,
  headerImageAlt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } }
} as const;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let suffix = 0;

  while (true) {
    const existing = await prisma.blogArticle.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!existing || existing.id === excludeId) return slug;
    suffix++;
    slug = `${base}-${suffix}`;
  }
}

async function validateCategorySlug(categorySlug: string): Promise<void> {
  const page = await prisma.landingPage.findUnique({
    where: { slug: "home" },
    select: { status: true, publishedContent: true }
  });

  if (!page || page.status !== "published" || !page.publishedContent) {
    badRequest("Nenhuma categoria disponível. Publique o conteúdo da landing page primeiro.");
  }

  const content = page.publishedContent as Record<string, unknown>;
  const categories = content.categories as Array<{ slug: string }> | undefined;

  if (!categories?.length) {
    badRequest("Nenhuma categoria cadastrada no conteúdo publicado.");
  }

  const found = categories.some((c) => c.slug === categorySlug);
  if (!found) {
    const available = categories.map((c) => c.slug).join(", ");
    badRequest(`Categoria "${categorySlug}" não encontrada. Disponíveis: ${available}`);
  }
}

async function handleHeaderImage(
  file: File | null | undefined,
  slug: string,
  userId: string,
  existingUrl?: string | null
): Promise<{ headerImageUrl: string | null; assetId?: string }> {
  if (!file) return { headerImageUrl: existingUrl ?? null };

  if (existingUrl) {
    await deleteBlobAsset(existingUrl).catch(() => {});
  }

  const prepared = await prepareImageAsset(file);
  const pathname = `blog/${slug}/header.webp`;
  const blob = await uploadPublicAsset(pathname, prepared);

  const asset = await prisma.asset.create({
    data: {
      kind: "image",
      entityType: "blogArticle",
      entityId: slug,
      fieldKey: "headerImage",
      pathname,
      url: blob.url,
      mimeType: "image/webp",
      sizeBytes: prepared.sizeBytes,
      originalFilename: prepared.originalFilename,
      createdById: userId
    }
  });

  return { headerImageUrl: blob.url, assetId: asset.id };
}

export async function createBlogArticle(
  input: CreateBlogArticleInput,
  authorId: string,
  headerImageFile?: File | null
): Promise<BlogArticleRecord> {
  await validateCategorySlug(input.categorySlug);

  const baseSlug = generateSlug(input.title);
  const slug = await ensureUniqueSlug(baseSlug);

  const { headerImageUrl } = await handleHeaderImage(headerImageFile, slug, authorId);

  return prisma.blogArticle.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      categorySlug: input.categorySlug,
      headerImageUrl,
      headerImageAlt: input.headerImageAlt ?? null,
      authorId
    },
    select: articleSelect
  });
}

export async function listBlogArticles(query: BlogListQuery): Promise<BlogArticlesListResult> {
  const skip = (query.page - 1) * query.perPage;
  const where = query.categorySlug ? { categorySlug: query.categorySlug } : {};

  const [articles, total] = await Promise.all([
    prisma.blogArticle.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: { publishedAt: "desc" },
      select: articleListSelect
    }),
    prisma.blogArticle.count({ where })
  ]);

  return {
    articles,
    pagination: { page: query.page, perPage: query.perPage, total }
  };
}

export async function getBlogArticleBySlug(slug: string): Promise<BlogArticleRecord> {
  const article = await prisma.blogArticle.findUnique({
    where: { slug },
    select: articleSelect
  });

  if (!article) notFound("Artigo não encontrado.");
  return article;
}

export async function updateBlogArticle(
  slug: string,
  input: UpdateBlogArticleInput,
  userId: string,
  headerImageFile?: File | null
): Promise<BlogArticleRecord> {
  const existing = await prisma.blogArticle.findUnique({
    where: { slug },
    select: { id: true, slug: true, headerImageUrl: true }
  });

  if (!existing) notFound("Artigo não encontrado.");

  if (input.categorySlug) {
    await validateCategorySlug(input.categorySlug);
  }

  let newSlug = existing.slug;
  if (input.title) {
    const baseSlug = generateSlug(input.title);
    newSlug = await ensureUniqueSlug(baseSlug, existing.id);
  }

  let headerImageUrl = existing.headerImageUrl;

  if (input.removeHeaderImage && existing.headerImageUrl) {
    await deleteBlobAsset(existing.headerImageUrl).catch(() => {});
    headerImageUrl = null;
  } else if (headerImageFile) {
    const result = await handleHeaderImage(headerImageFile, newSlug, userId, existing.headerImageUrl);
    headerImageUrl = result.headerImageUrl;
  }

  return prisma.blogArticle.update({
    where: { slug },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.title && { slug: newSlug }),
      ...(input.content && { content: input.content }),
      ...(input.categorySlug && { categorySlug: input.categorySlug }),
      ...(input.headerImageAlt !== undefined && { headerImageAlt: input.headerImageAlt ?? null }),
      headerImageUrl
    },
    select: articleSelect
  });
}

export async function deleteBlogArticle(slug: string): Promise<void> {
  const article = await prisma.blogArticle.findUnique({
    where: { slug },
    select: { id: true, headerImageUrl: true }
  });

  if (!article) notFound("Artigo não encontrado.");

  if (article.headerImageUrl) {
    await deleteBlobAsset(article.headerImageUrl).catch(() => {});
  }

  await prisma.asset.deleteMany({
    where: { entityType: "blogArticle", entityId: slug }
  });

  await prisma.blogArticle.delete({ where: { slug } });
}
