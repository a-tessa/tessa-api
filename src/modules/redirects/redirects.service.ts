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

async function collapseChains(
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

export async function createRedirect(
  input: CreateRedirectInput,
  db: RedirectDb = prisma
): Promise<RedirectRecord> {
  const fromPath = normalizePath(input.fromPath);
  const toPath = normalizeDestination(input.toPath);

  if (fromPath === toPath) {
    badRequest("A origem e o destino do redirecionamento não podem ser iguais.");
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

  await collapseChains(db, fromPath, toPath);
  return record;
}

export async function updateRedirect(
  id: string,
  input: UpdateRedirectInput,
  db: RedirectDb = prisma
): Promise<RedirectRecord> {
  const existing = await db.redirect.findUnique({ where: { id } });
  if (!existing) notFound("Redirecionamento não encontrado.");

  const fromPath = input.fromPath ? normalizePath(input.fromPath) : existing.fromPath;
  const toPath = input.toPath ? normalizeDestination(input.toPath) : existing.toPath;

  if (fromPath === toPath) {
    badRequest("A origem e o destino do redirecionamento não podem ser iguais.");
  }

  if (fromPath !== existing.fromPath) {
    const conflict = await db.redirect.findUnique({ where: { fromPath } });
    if (conflict && conflict.id !== existing.id) {
      badRequest("Já existe um redirecionamento com este caminho de origem.");
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

  await collapseChains(db, fromPath, toPath);
  return record;
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

  return {
    redirects,
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
