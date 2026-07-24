import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  industrySectionSchema
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

// These tests assert deterministic, untranslated pt-BR fallback behavior and must
// never trigger a real background translation call, even if this machine's local
// environment happens to have real translation credentials configured.
process.env.TRANSLATION_ENABLED = "false";

const industrySection = {
  titlePrefix: "A força da",
  title: "indústria brasileira",
  subtitle: "Estruturas projetadas para transformar grandes ideias em realidade.",
  videos: {
    "pt-BR": {
      url: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
      startSeconds: 8
    },
    es: {
      url: "https://www.youtube.com/watch?v=eGdFPCZYNYQ",
      startSeconds: 6
    }
  }
};

describe("industry section content", () => {
  it("accepts a valid section and keeps the section optional", () => {
    assert.equal(draftContentSchema.parse({}).industrySection, undefined);
    assert.deepEqual(industrySectionSchema.parse(industrySection), industrySection);
  });

  it("accepts optional English and Spanish videos without requiring them", () => {
    assert.deepEqual(
      industrySectionSchema.parse(industrySection).videos,
      industrySection.videos
    );

    const withLocalizedVideos = {
      ...industrySection,
      videos: {
        ...industrySection.videos,
        en: { url: "https://youtu.be/EeLYcZsdYrw" },
        es: { url: "https://www.youtube.com/watch?v=eGdFPCZYNYQ", startSeconds: 6 }
      }
    };
    assert.deepEqual(
      industrySectionSchema.parse(withLocalizedVideos),
      withLocalizedVideos
    );

    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        videos: {
          ...industrySection.videos,
          en: { url: "https://example.com/not-youtube" }
        }
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        videos: {
          ...industrySection.videos,
          es: { url: "https://youtu.be/eGdFPCZYNYQ", startSeconds: -1 }
        }
      }).success,
      false
    );
  });

  it("enforces text limits and the current YouTube URL formats", () => {
    for (const field of ["titlePrefix", "title", "subtitle"] as const) {
      assert.equal(
        industrySectionSchema.safeParse({
          ...industrySection,
          [field]: " "
        }).success,
        false
      );
    }
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        titlePrefix: "a".repeat(61)
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        title: "a".repeat(101)
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        subtitle: "a".repeat(301)
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        videos: {
          "pt-BR": { url: "https://example.com/not-youtube" }
        }
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        videos: {
          "pt-BR": { url: "https://youtu.be/EeLYcZsdYrw", startSeconds: -1 }
        }
      }).success,
      false
    );
    assert.equal(
      industrySectionSchema.safeParse({
        ...industrySection,
        videos: {
          "pt-BR": {
            url: "https://youtu.be/EeLYcZsdYrw",
            startSeconds: 1.5
          }
        }
      }).success,
      false
    );
  });

  it("publishes the Portuguese section as-is", () => {
    const published = sanitizeContentForPublish({ industrySection });
    assert.deepEqual(
      (published as Record<string, unknown>).industrySection,
      industrySection
    );
  });

  it("extracts the Portuguese texts for translation but never the video configuration", () => {
    assert.deepEqual(extractLandingItems({ industrySection }), [
      { id: "industry.titlePrefix", text: industrySection.titlePrefix, format: "plain" },
      { id: "industry.title", text: industrySection.title, format: "plain" },
      { id: "industry.subtitle", text: industrySection.subtitle, format: "plain" }
    ]);
  });

  it("applies translated texts while keeping the source videos untouched", () => {
    const localized = applyLandingItems(
      { industrySection },
      {
        "industry.titlePrefix": "The strength of",
        "industry.title": "Brazilian industry",
        "industry.subtitle": "Localized subtitle"
      }
    );

    assert.deepEqual(localized.industrySection, {
      ...industrySection,
      titlePrefix: "The strength of",
      title: "Brazilian industry",
      subtitle: "Localized subtitle"
    });
  });

  it("keeps the Portuguese text when a translation is missing for a locale", () => {
    const localized = applyLandingItems(
      { industrySection },
      { "industry.title": "Brazilian industry" }
    );

    assert.deepEqual(localized.industrySection, {
      ...industrySection,
      title: "Brazilian industry"
    });
  });

  it("requires authentication for every CRUD operation", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
    process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
    process.env.MASTER_SETUP_KEY ??= "test-setup-key";

    const { adminContentRouter } = await import("../content.admin-router.js");
    for (const method of ["DELETE", "GET", "POST", "PUT"]) {
      const response = await adminContentRouter.request("/industry-section", {
        method
      });
      assert.equal(response.status, 401);
    }
  });

  it("lets ADMIN and MASTER persist a draft and publish it globally", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
    process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
    process.env.MASTER_SETUP_KEY ??= "test-setup-key";

    const [{ adminContentRouter }, { publicContentRouter }, { createAccessToken }, { prisma }] =
      await Promise.all([
        import("../content.admin-router.js"),
        import("../content.public-router.js"),
        import("../../../lib/auth.js"),
        import("../../../lib/prisma.js")
      ]);

    interface InMemoryPage {
      id: string;
      slug: string;
      title: string;
      seoTitle: null;
      seoDescription: null;
      status: "draft" | "published";
      draftContent: Record<string, unknown>;
      publishedContent: Record<string, unknown> | null;
      publishedAt: Date | null;
      updatedAt: Date;
      createdAt: Date;
      updatedById: string;
      publishedById: string | null;
    }

    let currentRole: "ADMIN" | "MASTER" = "ADMIN";
    let page: InMemoryPage | null = null;

    function getPage(): InMemoryPage {
      assert.ok(page);
      return page;
    }

    Object.defineProperty(prisma.user, "findUnique", {
      configurable: true,
      value: async () => ({
        id: "user-1",
        email: "admin@tessa.com.br",
        role: currentRole,
        isActive: true
      })
    });
    Object.defineProperty(prisma.landingPage, "findUnique", {
      configurable: true,
      value: async () => page
    });
    Object.defineProperty(prisma.landingPage, "create", {
      configurable: true,
      value: async (rawArgs: unknown) => {
        const args = rawArgs as {
          data: {
            slug: string;
            title: string;
            draftContent: Record<string, unknown>;
            status: "draft";
            updatedById: string;
          };
        };
        const now = new Date();
        page = {
          // A fresh id per run avoids ever colliding with a real completed
          // translation row from a previous run against a real database.
          id: randomUUID(),
          slug: args.data.slug,
          title: args.data.title,
          seoTitle: null,
          seoDescription: null,
          status: args.data.status,
          draftContent: args.data.draftContent,
          publishedContent: null,
          publishedAt: null,
          updatedAt: now,
          createdAt: now,
          updatedById: args.data.updatedById,
          publishedById: null
        };
        return page;
      }
    });
    Object.defineProperty(prisma.landingPage, "update", {
      configurable: true,
      value: async (rawArgs: unknown) => {
        const args = rawArgs as {
          data: Partial<InMemoryPage>;
        };
        page = {
          ...getPage(),
          ...args.data,
          updatedAt: new Date()
        };
        return page;
      }
    });
    Object.defineProperty(prisma.npsResponse, "findMany", {
      configurable: true,
      value: async () => []
    });

    for (const role of ["ADMIN", "MASTER"] as const) {
      currentRole = role;
      page = null;
      const token = await createAccessToken({
        id: "user-1",
        email: "admin@tessa.com.br",
        role
      });
      const headers = {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      };

      const createResponse = await adminContentRouter.request("/industry-section", {
        method: "POST",
        headers,
        body: JSON.stringify(industrySection)
      });
      assert.equal(createResponse.status, 201);
      assert.deepEqual(getPage().draftContent, { industrySection });
      assert.equal(getPage().publishedContent, null);
      const getCreatedResponse = await adminContentRouter.request("/industry-section", {
        headers
      });
      assert.equal(getCreatedResponse.status, 200);
      assert.deepEqual(await getCreatedResponse.json(), { industrySection });

      const updatedSection = {
        ...industrySection,
        title: `Indústria ${role}`
      };
      const updateResponse = await adminContentRouter.request("/industry-section", {
        method: "PUT",
        headers,
        body: JSON.stringify(updatedSection)
      });
      assert.equal(updateResponse.status, 200);
      assert.deepEqual(getPage().draftContent, { industrySection: updatedSection });
      assert.equal(getPage().publishedContent, null);
      const getUpdatedResponse = await adminContentRouter.request("/industry-section", {
        headers
      });
      assert.equal(getUpdatedResponse.status, 200);
      assert.deepEqual(await getUpdatedResponse.json(), {
        industrySection: updatedSection
      });

      const publishResponse = await adminContentRouter.request("/publish", {
        method: "POST",
        headers
      });
      assert.equal(publishResponse.status, 200);
      assert.deepEqual(getPage().publishedContent, {
        industrySection: updatedSection,
        scenerySection: []
      });

      const publicResponse = await publicContentRouter.request("/?locale=pt-BR");
      assert.equal(publicResponse.status, 200);
      const publicPayload = (await publicResponse.json()) as {
        content: { industrySection: typeof updatedSection };
      };
      assert.deepEqual(publicPayload.content.industrySection, updatedSection);

      // Without translation configured, a locale without a completed translation row
      // still gets the published content: pt-BR text as a safe fallback, and every
      // locale's video configuration untouched (video selection is the client's job).
      const publicEsResponse = await publicContentRouter.request("/?locale=es");
      assert.equal(publicEsResponse.status, 200);
      const publicEsPayload = (await publicEsResponse.json()) as {
        content: { industrySection: typeof updatedSection };
      };
      assert.deepEqual(publicEsPayload.content.industrySection, updatedSection);

      const deleteResponse = await adminContentRouter.request("/industry-section", {
        method: "DELETE",
        headers
      });
      assert.equal(deleteResponse.status, 204);
      assert.deepEqual(getPage().draftContent, {});
      assert.deepEqual(getPage().publishedContent, {
        industrySection: updatedSection,
        scenerySection: []
      });
    }
  });
});
