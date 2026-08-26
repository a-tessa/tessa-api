import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateRedirectInput,
  RedirectListQuery,
  RedirectListResult,
  RedirectRecord,
  UpdateRedirectInput
} from "./redirects.types.js";

export type RedirectDb = PrismaClient | Prisma.TransactionClient;

const LOCALE_PREFIXES = new Set(["en", "es", "pt-br"]);

export function normalizePath(value: string): string {
  const trimmed = value.trim();
  const withoutQuery = trimmed.split("#")[0]?.split("?")[0] ?? "";
  let path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  path = path.toLowerCase();
  if (path.length > 1) {
    path = path.replace(/\/+$/, "");
  }

  const firstSegment = path.split("/").filter(Boolean)[0];
  if (firstSegment && LOCALE_PREFIXES.has(firstSegment)) {
    const rest = path.slice(firstSegment.length + 1);
    path = rest.length === 0 ? "/" : rest;
  }

  return path.length === 0 ? "/" : path;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function normalizeDestination(value: string): string {
  const trimmed = value.trim();
  if (isAbsoluteHttpUrl(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        badRequest("O destino precisa ser um caminho interno ou uma URL http(s).");
      }
      return trimmed;
    } catch {
      badRequest("O destino precisa ser um caminho interno ou uma URL http(s).");
    }
  }

  return normalizePath(trimmed);
}

const FIXED_PUBLIC_PATHS = new Set([
  "/",
  "/quem-somos",
  "/servicos",
  "/representantes",
  "/blog",
  "/downloads",
  "/galeria",
  "/contato"
]);

const STATIC_SERVICE_SLUGS = new Set([
  "estruturas-metalicas-para-telhado",
  "carport",
  "estrutura-de-solo",
  "estrutura-de-aviario",
  "estruturas-para-creches",
  "perfis-especiais"
]);

const LIVE_ORIGIN_MESSAGE =
  "Não é possível redirecionar uma página que ainda está no ar. Altere a URL do conteúdo ou cadastre outro caminho de origem.";
const CYCLE_MESSAGE = "Este redirecionamento forma um ciclo.";

function slugFromPrefixedPath(path: string, prefix: "/blog/" | "/servicos/"): string | null {
  if (!path.startsWith(prefix)) return null;
  const slug = path.slice(prefix.length);
  if (!slug || slug.includes("/")) return null;
  return slug;
}

function publishedServiceSlugs(publishedContent: unknown): Set<string> {
  const slugs = new Set<string>(STATIC_SERVICE_SLUGS);
  if (!publishedContent || typeof publishedContent !== "object") return slugs;
  const pages = (publishedContent as { servicesPages?: unknown }).servicesPages;
  if (!Array.isArray(pages)) return slugs;
  for (const page of pages) {
    if (
      page &&
      typeof page === "object" &&
      "slug" in page &&
      typeof page.slug === "string" &&
      page.slug.length > 0
    ) {
      slugs.add(page.slug);
    }
  }
  return slugs;
}

async function isLivePublicPath(path: string, db: RedirectDb): Promise<boolean> {
  if (FIXED_PUBLIC_PATHS.has(path)) return true;

  const blogSlug = slugFromPrefixedPath(path, "/blog/");
  if (blogSlug) {
    const article = await db.blogArticle.findFirst({
      where: { slug: blogSlug, status: "published" },
      select: { id: true }
    });
    return article !== null;
  }

  const serviceSlug = slugFromPrefixedPath(path, "/servicos/");
  if (!serviceSlug) return false;
  if (STATIC_SERVICE_SLUGS.has(serviceSlug)) return true;

  const landing = await db.landingPage.findUnique({
    where: { slug: "home" },
    select: { publishedContent: true }
  });
  return publishedServiceSlugs(landing?.publishedContent).has(serviceSlug);
}

async function loadLivePublicPaths(): Promise<{
  blogSlugs: Set<string>;
  serviceSlugs: Set<string>;
}> {
  const [articles, landing] = await Promise.all([
    prisma.blogArticle.findMany({
      where: { status: "published" },
      select: { slug: true }
    }),
    prisma.landingPage.findUnique({
      where: { slug: "home" },
      select: { publishedContent: true }
    })
  ]);

  return {
    blogSlugs: new Set(articles.map((article) => article.slug)),
    serviceSlugs: publishedServiceSlugs(landing?.publishedContent)
  };
}

function isPathOccupied(
  path: string,
  live: { blogSlugs: Set<string>; serviceSlugs: Set<string> }
): boolean {
  if (FIXED_PUBLIC_PATHS.has(path)) return true;
  const blogSlug = slugFromPrefixedPath(path, "/blog/");
  if (blogSlug) return live.blogSlugs.has(blogSlug);
  const serviceSlug = slugFromPrefixedPath(path, "/servicos/");
  if (serviceSlug) return live.serviceSlugs.has(serviceSlug);
  return false;
}

function isDestinationMissing(
  toPath: string,
  live: { blogSlugs: Set<string>; serviceSlugs: Set<string> }
): boolean {
  if (isAbsoluteHttpUrl(toPath)) return false;
  const blogSlug = slugFromPrefixedPath(toPath, "/blog/");
  if (blogSlug) return !live.blogSlugs.has(blogSlug);
  const serviceSlug = slugFromPrefixedPath(toPath, "/servicos/");
  if (serviceSlug) return !live.serviceSlugs.has(serviceSlug);
  return false;
}

async function resolveTerminalDestination(
  db: RedirectDb,
  start: string,
  originFromPath: string
): Promise<string> {
  if (isAbsoluteHttpUrl(start)) return start;

  const seen = new Set<string>([originFromPath]);
  let current = start;

  while (!isAbsoluteHttpUrl(current)) {
    if (seen.has(current)) {
      badRequest(CYCLE_MESSAGE);
    }
    seen.add(current);
    if (seen.size > 20) {
      badRequest(CYCLE_MESSAGE);
    }
    const next = await db.redirect.findUnique({ where: { fromPath: current } });
    if (!next) return current;
    current = next.toPath;
  }

  return current;
}

async function collapseInbound(
  db: RedirectDb,
  fromPath: string,
  toPath: string
): Promise<void> {
  await db.redirect.deleteMany({
    where: { toPath: fromPath, fromPath: toPath }
  });
  await db.redirect.updateMany({
    where: { toPath: fromPath },
    data: { toPath }
  });
}

function hasTransaction(db: RedirectDb): db is PrismaClient {
  return "$transaction" in db;
}

async function persistRedirect(
  db: RedirectDb,
  input: CreateRedirectInput
): Promise<RedirectRecord> {
  const fromPath = normalizePath(input.fromPath);
  const requestedTo = normalizeDestination(input.toPath);

  if (fromPath === requestedTo) {
    badRequest("A origem e o destino do redirecionamento não podem ser iguais.");
  }

  const toPath = await resolveTerminalDestination(db, requestedTo, fromPath);
  if (fromPath === toPath) {
    badRequest(CYCLE_MESSAGE);
  }

  if (await isLivePublicPath(fromPath, db)) {
    badRequest(LIVE_ORIGIN_MESSAGE);
  }

  const existing = await db.redirect.findUnique({ where: { fromPath } });
  const data = {
    fromPath,
    toPath,
    statusCode: input.statusCode ?? 301,
    source: input.source ?? "manual",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null
  };

  const record = existing
    ? await db.redirect.update({
        where: { id: existing.id },
        data
      })
    : await db.redirect.create({ data });

  await collapseInbound(db, fromPath, toPath);
  return record;
}

export async function createRedirect(
  input: CreateRedirectInput,
  db: RedirectDb = prisma
): Promise<RedirectRecord> {
  if (hasTransaction(db)) {
    return db.$transaction((tx) => persistRedirect(tx, input));
  }
  return persistRedirect(db, input);
}

async function persistUpdateRedirect(
  db: RedirectDb,
  id: string,
  input: UpdateRedirectInput
): Promise<RedirectRecord> {
  const existing = await db.redirect.findUnique({ where: { id } });
  if (!existing) notFound("Redirecionamento não encontrado.");

  const fromPath = input.fromPath ? normalizePath(input.fromPath) : existing.fromPath;
  const requestedTo = input.toPath ? normalizeDestination(input.toPath) : existing.toPath;

  if (fromPath === requestedTo) {
    badRequest("A origem e o destino do redirecionamento não podem ser iguais.");
  }

  const toPath = await resolveTerminalDestination(db, requestedTo, fromPath);
  if (fromPath === toPath) {
    badRequest(CYCLE_MESSAGE);
  }

  if (fromPath !== existing.fromPath) {
    const conflict = await db.redirect.findUnique({ where: { fromPath } });
    if (conflict && conflict.id !== existing.id) {
      badRequest("Já existe um redirecionamento com este caminho de origem.");
    }
    if (await isLivePublicPath(fromPath, db)) {
      badRequest(LIVE_ORIGIN_MESSAGE);
    }
  }

  const record = await db.redirect.update({
    where: { id },
    data: {
      fromPath,
      toPath,
      statusCode: input.statusCode ?? existing.statusCode,
      source: "manual"
    }
  });

  await collapseInbound(db, fromPath, toPath);
  return record;
}

export async function updateRedirect(
  id: string,
  input: UpdateRedirectInput,
  db: RedirectDb = prisma
): Promise<RedirectRecord> {
  if (hasTransaction(db)) {
    return db.$transaction((tx) => persistUpdateRedirect(tx, id, input));
  }
  return persistUpdateRedirect(db, id, input);
}

export async function deleteRedirect(id: string, db: RedirectDb = prisma): Promise<void> {
  const existing = await db.redirect.findUnique({ where: { id } });
  if (!existing) notFound("Redirecionamento não encontrado.");
  await db.redirect.delete({ where: { id } });
}

export async function listRedirects(query: RedirectListQuery): Promise<RedirectListResult> {
  const skip = (query.page - 1) * query.perPage;
  const where = query.q
    ? {
        OR: [
          { fromPath: { contains: query.q, mode: "insensitive" as const } },
          { toPath: { contains: query.q, mode: "insensitive" as const } }
        ]
      }
    : {};

  const [redirects, total] = await Promise.all([
    prisma.redirect.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: { fromPath: "asc" }
    }),
    prisma.redirect.count({ where })
  ]);

  const live = await loadLivePublicPaths();

  return {
    redirects: redirects.map((record) => ({
      ...record,
      destinationMissing: isDestinationMissing(record.toPath, live),
      sourceOccupied: isPathOccupied(record.fromPath, live)
    })),
    pagination: { page: query.page, perPage: query.perPage, total }
  };
}

export async function listPublicRedirects(): Promise<RedirectRecord[]> {
  return prisma.redirect.findMany({
    orderBy: { fromPath: "asc" },
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
      source: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function releaseRedirectOccupyingPath(
  path: string,
  db: RedirectDb = prisma
): Promise<void> {
  const fromPath = normalizePath(path);
  await db.redirect.deleteMany({ where: { fromPath } });
}

export async function recordSlugChangeRedirect(
  input: {
    fromPath: string;
    toPath: string;
    entityType: string;
    entityId: string;
  },
  db: RedirectDb = prisma
): Promise<void> {
  const fromPath = normalizePath(input.fromPath);
  const toPath = normalizePath(input.toPath);

  await releaseRedirectOccupyingPath(toPath, db);

  if (fromPath === toPath) return;

  const existing = await db.redirect.findUnique({ where: { fromPath } });
  if (existing?.source === "manual") return;

  await createRedirect(
    {
      fromPath,
      toPath,
      statusCode: 301,
      source: "slugChange",
      entityType: input.entityType,
      entityId: input.entityId
    },
    db
  );
}
