import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

process.env.TRANSLATION_ENABLED = "false";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";

describe("homepage publication status", () => {
  it("exposes structured localization status and allows a later retry without re-editing", async () => {
    const [{ adminContentRouter }, { createAccessToken }, { prisma }] = await Promise.all([
      import("../content.admin-router.js"),
      import("../../../lib/auth.js"),
      import("../../../lib/prisma.js")
    ]);

    const pageId = randomUUID();
    const now = new Date();
    const publishedContent = {
      industrySection: {
        titlePrefix: "A força da",
        title: "indústria brasileira",
        subtitle: "Texto",
        videos: {
          "pt-BR": {
            url: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
            startSeconds: 8
          }
        }
      }
    };

    const translations = new Map<string, {
      id: string;
      entityType: string;
      entityId: string;
      locale: "en" | "es";
      status: "pending" | "processing" | "completed" | "failed";
      content: Record<string, string> | null;
      previousContent: null;
      sourceHash: string;
      error: string | null;
      attempts: number;
      updatedAt: Date;
    }>();

    translations.set("en", {
      id: "tr-en",
      entityType: "landingPage",
      entityId: pageId,
      locale: "en",
      status: "failed",
      content: null,
      previousContent: null,
      sourceHash: "hash",
      error: "timeout",
      attempts: 2,
      updatedAt: now
    });

    Object.defineProperty(prisma.user, "findUnique", {
      configurable: true,
      value: async () => ({
        id: "user-1",
        email: "admin@tessa.com.br",
        role: "ADMIN",
        isActive: true
      })
    });
    Object.defineProperty(prisma.landingPage, "findUnique", {
      configurable: true,
      value: async () => ({
        id: pageId,
        slug: "home",
        title: "Home",
        status: "published",
        draftContent: publishedContent,
        publishedContent,
        publishedAt: now,
        updatedAt: now,
        createdAt: now,
        updatedById: "user-1",
        publishedById: "user-1"
      })
    });
    Object.defineProperty(prisma.translation, "findMany", {
      configurable: true,
      value: async () => [...translations.values()]
    });
    Object.defineProperty(prisma.translation, "findUnique", {
      configurable: true,
      value: async (rawArgs: unknown) => {
        const args = rawArgs as {
          where: { entityType_entityId_locale: { locale: "en" | "es" } };
        };
        return translations.get(args.where.entityType_entityId_locale.locale) ?? null;
      }
    });
    Object.defineProperty(prisma.translation, "upsert", {
      configurable: true,
      value: async (rawArgs: unknown) => {
        const args = rawArgs as {
          where: { entityType_entityId_locale: { locale: "en" | "es" } };
          create: {
            entityType: string;
            entityId: string;
            locale: "en" | "es";
            status: "pending";
            sourceHash: string;
          };
          update: { status: "pending"; error: null; attempts: number };
        };
        const locale = args.where.entityType_entityId_locale.locale;
        const next = {
          id: translations.get(locale)?.id ?? `tr-${locale}`,
          entityType: args.create.entityType,
          entityId: args.create.entityId,
          locale,
          status: "pending" as const,
          content: null,
          previousContent: null,
          sourceHash: args.create.sourceHash,
          error: null,
          attempts: 0,
          updatedAt: new Date()
        };
        translations.set(locale, next);
        return next;
      }
    });

    const token = await createAccessToken({
      id: "user-1",
      email: "admin@tessa.com.br",
      role: "ADMIN"
    });
    const headers = { authorization: `Bearer ${token}` };

    const statusResponse = await adminContentRouter.request("/publication-status", {
      headers
    });
    assert.equal(statusResponse.status, 200);
    const statusPayload = (await statusResponse.json()) as {
      translations: {
        configured: boolean;
        locales: Array<{
          locale: string;
          status: string;
          error: string | null;
          fields: string[];
        }>;
      };
    };

    assert.equal(statusPayload.translations.configured, false);
    const enStatus = statusPayload.translations.locales.find((locale) => locale.locale === "en");
    const esStatus = statusPayload.translations.locales.find((locale) => locale.locale === "es");
    assert.equal(enStatus?.status, "failed");
    assert.equal(enStatus?.error, "timeout");
    assert.ok(enStatus?.fields.includes("industry.title"));
    assert.equal(esStatus?.status, "not_started");

    const retryResponse = await adminContentRouter.request("/translations/retry", {
      method: "POST",
      headers
    });
    assert.equal(retryResponse.status, 200);
    // With TRANSLATION_ENABLED=false the retry is a no-op that still returns
    // the structured status, so editors can retry later without re-uploading.
    const retryPayload = (await retryResponse.json()) as typeof statusPayload;
    assert.equal(
      retryPayload.translations.locales.find((locale) => locale.locale === "en")?.status,
      "failed"
    );
  });

  it("keeps Portuguese publish successful when localization rows remain failed", async () => {
    const [{ adminContentRouter }, { createAccessToken }, { prisma }] = await Promise.all([
      import("../content.admin-router.js"),
      import("../../../lib/auth.js"),
      import("../../../lib/prisma.js")
    ]);

    const pageId = randomUUID();
    const now = new Date();
    let page = {
      id: pageId,
      slug: "home",
      title: "Home",
      seoTitle: null,
      seoDescription: null,
      status: "draft" as const,
      draftContent: {
        industrySection: {
          titlePrefix: "A força da",
          title: "indústria brasileira",
          subtitle: "Texto",
          videos: {
            "pt-BR": { url: "https://www.youtube.com/watch?v=EeLYcZsdYrw" }
          }
        }
      },
      publishedContent: null as Record<string, unknown> | null,
      publishedAt: null as Date | null,
      updatedAt: now,
      createdAt: now,
      updatedById: "user-1",
      publishedById: null as string | null
    };

    Object.defineProperty(prisma.user, "findUnique", {
      configurable: true,
      value: async () => ({
        id: "user-1",
        email: "admin@tessa.com.br",
        role: "ADMIN",
        isActive: true
      })
    });
    Object.defineProperty(prisma.landingPage, "findUnique", {
      configurable: true,
      value: async () => page
    });
    Object.defineProperty(prisma.landingPage, "update", {
      configurable: true,
      value: async (rawArgs: unknown) => {
        const args = rawArgs as { data: Partial<typeof page> };
        page = {
          ...page,
          ...args.data,
          updatedAt: new Date()
        };
        return page;
      }
    });
    Object.defineProperty(prisma.asset, "findMany", {
      configurable: true,
      value: async () => []
    });
    Object.defineProperty(prisma.npsResponse, "findMany", {
      configurable: true,
      value: async () => []
    });
    Object.defineProperty(prisma.translation, "findUnique", {
      configurable: true,
      value: async () => ({
        id: "tr-en",
        status: "failed",
        sourceHash: "old",
        content: null
      })
    });
    Object.defineProperty(prisma.translation, "upsert", {
      configurable: true,
      value: async () => ({ id: "tr-en", status: "pending" })
    });

    const token = await createAccessToken({
      id: "user-1",
      email: "admin@tessa.com.br",
      role: "ADMIN"
    });

    const publishResponse = await adminContentRouter.request("/publish", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(publishResponse.status, 200);
    assert.ok(page.publishedContent);
    assert.deepEqual(
      (page.publishedContent as { industrySection: { title: string } }).industrySection.title,
      "indústria brasileira"
    );
  });
});
