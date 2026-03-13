import { zValidator } from "@hono/zod-validator";
import { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import type { AppBindings } from "../types.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const pageSchema = z.object({
  title: z.string().min(2),
  seoTitle: z.string().min(2).max(80).optional().nullable(),
  seoDescription: z.string().min(2).max(160).optional().nullable(),
  draftContent: z.record(z.string(), z.unknown())
});

export const contentRouter = new Hono<AppBindings>();

contentRouter.get("/public/pages/:slug", async (c) => {
  const { slug } = c.req.param();

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
    return;
  }

  return c.json({ page });
});

contentRouter.get(
  "/admin/pages",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("query", z.object({
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
  })),
  async (c) => {
    const { page, perPage } = c.req.valid("query");
    const skip = (page - 1) * perPage;

    const [pages, total] = await Promise.all([
      prisma.landingPage.findMany({
        skip,
        take: perPage,
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
      prisma.landingPage.count(),
    ]);

    return c.json({
      pages,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    });
  }
);

contentRouter.get(
  "/admin/pages/:slug",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const { slug } = c.req.param();
    const page = await prisma.landingPage.findUnique({
      where: { slug }
    });

    if (!page) {
      notFound("Página não encontrada.");
      return;
    }

    return c.json({ page });
  }
);

contentRouter.put(
  "/admin/pages/:slug",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("json", pageSchema),
  async (c) => {
    const input = c.req.valid("json");
    const { slug } = c.req.param();
    const user = c.get("user");

    const draftContent = input.draftContent as Prisma.InputJsonValue;

    const page = await prisma.landingPage.upsert({
      where: { slug },
      create: {
        slug,
        title: input.title,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        draftContent,
        status: "draft",
        updatedById: user.id
      },
      update: {
        title: input.title,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        draftContent,
        status: "draft",
        updatedById: user.id
      }
    });

    return c.json({ page });
  }
);

contentRouter.post(
  "/admin/pages/:slug/publish",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const { slug } = c.req.param();
    const user = c.get("user");

    const existingPage = await prisma.landingPage.findUnique({
      where: { slug }
    });

    if (!existingPage) {
      notFound("Página não encontrada.");
      return;
    }

    const page = await prisma.landingPage.update({
      where: { slug },
      data: {
        status: "published",
        publishedContent: existingPage.draftContent as Prisma.InputJsonValue,
        publishedAt: new Date(),
        publishedById: user.id,
        updatedById: user.id
      }
    });

    return c.json({ page });
  }
);
