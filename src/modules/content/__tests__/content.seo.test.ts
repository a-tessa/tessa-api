import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  MAX_SEO_META_DESCRIPTION_LENGTH,
  MAX_SEO_META_TITLE_LENGTH,
  MAX_SEO_SOCIAL_DESCRIPTION_LENGTH,
  MAX_SEO_SOCIAL_TITLE_LENGTH,
  pageSeoEntrySchema,
  pageSeoSchema,
  SEO_PAGE_KEYS,
  seoDefaultsSchema,
  seoPageKeySchema
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

const seoDefaults = {
  siteName: "Tessa Tecnologia e Desenvolvimento LTDA",
  titleTemplate: "%s | Tessa",
  defaultMetaDescription:
    "Aço galvanizado. Engenharia aplicada. Produção industrial.",
  keywords: ["Estrutura metálica para telhado", "Carport"],
  googleSiteVerification: "google-token",
  bingSiteVerification: "bing-token",
  allowIndexing: true
};

const pageSeo = {
  home: {
    metaTitle: "Estruturas metálicas para empresas",
    metaDescription: "Estruturas metálicas, perfis sob medida e energia solar para empresas.",
    focusKeyword: "estruturas metálicas",
    ogImageUrl: "https://blob.example/home-og.webp",
    noIndex: false,
    changeFrequency: "weekly" as const,
    priority: 1
  },
  blog: {
    metaTitle: "Blog",
    metaDescription: "Artigos técnicos sobre estruturas metálicas e energia solar.",
    noIndex: false
  }
};

describe("seoDefaults and pageSeo schemas", () => {
  it("accepts valid defaults and every known page key", () => {
    assert.deepEqual(seoDefaultsSchema.parse(seoDefaults), seoDefaults);
    assert.deepEqual(pageSeoSchema.parse(undefined), {});
    assert.deepEqual(pageSeoSchema.parse({}), {});

    for (const pageKey of SEO_PAGE_KEYS) {
      assert.equal(seoPageKeySchema.parse(pageKey), pageKey);
    }

    const parsed = pageSeoSchema.parse(pageSeo);
    assert.equal(parsed.home?.metaTitle, pageSeo.home.metaTitle);
    assert.equal(parsed.home?.noIndex, false);
    assert.equal(parsed.blog?.noIndex, false);
  });

  it("rejects a title template without %s, unknown page keys and oversized copy", () => {
    assert.equal(
      seoDefaultsSchema.safeParse({
        ...seoDefaults,
        titleTemplate: "Tessa"
      }).success,
      false
    );
    assert.equal(
      pageSeoSchema.safeParse({
        "pagina-extra": {
          metaTitle: "Extra",
          metaDescription: "Descrição extra da página."
        }
      }).success,
      false
    );
    assert.equal(
      pageSeoSchema.safeParse({
        home: {
          metaTitle: "a".repeat(MAX_SEO_META_TITLE_LENGTH + 1),
          metaDescription: "Descrição válida da página inicial da Tessa."
        }
      }).success,
      false
    );
    assert.equal(
      pageSeoSchema.safeParse({
        home: {
          metaTitle: "Título válido da home",
          metaDescription: "a".repeat(MAX_SEO_META_DESCRIPTION_LENGTH + 1)
        }
      }).success,
      false
    );
  });

  it("survives draft parsing and publish sanitization", () => {
    const draft = draftContentSchema.parse({ seoDefaults, pageSeo });
    assert.deepEqual(draft.seoDefaults, seoDefaults);
    assert.equal(draft.pageSeo?.home?.metaTitle, pageSeo.home.metaTitle);

    const published = sanitizeContentForPublish({ seoDefaults, pageSeo });
    assert.deepEqual((published as Record<string, unknown>).seoDefaults, seoDefaults);

    const publishedPages = (published as Record<string, unknown>).pageSeo as typeof pageSeo;
    assert.equal(publishedPages.home.metaTitle, pageSeo.home.metaTitle);
    assert.equal(publishedPages.home.ogImageUrl, pageSeo.home.ogImageUrl);
    assert.equal(publishedPages.blog.metaTitle, pageSeo.blog.metaTitle);
    assert.equal(publishedPages.blog.noIndex, false);
  });

  it("extracts translatable SEO copy and leaves template, URLs and verification codes untouched", () => {
    const extracted = extractLandingItems({ seoDefaults, pageSeo });
    const ids = extracted.map((item) => item.id);

    assert.deepEqual(ids, [
      "seo.defaults.defaultMetaDescription",
      "seo.defaults.keywords.0",
      "seo.defaults.keywords.1",
      "seo.page.home.metaTitle",
      "seo.page.home.metaDescription",
      "seo.page.home.focusKeyword",
      "seo.page.blog.metaTitle",
      "seo.page.blog.metaDescription"
    ]);

    const serialized = JSON.stringify(extracted);
    assert.equal(serialized.includes("%s | Tessa"), false);
    assert.equal(serialized.includes("google-token"), false);
    assert.equal(serialized.includes("bing-token"), false);
    assert.equal(serialized.includes("blob.example"), false);
    assert.equal(serialized.includes("Tessa Tecnologia"), false);
  });

  it("applies translated SEO copy without rewriting siteName, template or URLs", () => {
    const localized = applyLandingItems(
      { seoDefaults, pageSeo },
      {
        "seo.defaults.defaultMetaDescription": "Galvanized steel. Applied engineering.",
        "seo.defaults.keywords.0": "Metal roof structure",
        "seo.page.home.metaTitle": "Steel structures for companies",
        "seo.page.home.focusKeyword": "steel structures"
      }
    );

    const localizedDefaults = localized.seoDefaults as typeof seoDefaults;
    const localizedPages = localized.pageSeo as typeof pageSeo;

    assert.equal(localizedDefaults.siteName, seoDefaults.siteName);
    assert.equal(localizedDefaults.titleTemplate, seoDefaults.titleTemplate);
    assert.equal(
      localizedDefaults.defaultMetaDescription,
      "Galvanized steel. Applied engineering."
    );
    assert.equal(localizedDefaults.keywords[0], "Metal roof structure");
    assert.equal(localizedDefaults.keywords[1], "Carport");
    assert.equal(localizedDefaults.googleSiteVerification, "google-token");
    assert.equal(localizedPages.home.metaTitle, "Steel structures for companies");
    assert.equal(localizedPages.home.focusKeyword, "steel structures");
    assert.equal(localizedPages.home.ogImageUrl, pageSeo.home.ogImageUrl);
    assert.equal(localizedPages.blog.metaTitle, pageSeo.blog.metaTitle);
  });

  it("parses a legacy pageSeo entry with new fields undefined and noFollow false", () => {
    const parsed = pageSeoEntrySchema.parse({
      metaTitle: "Estruturas metálicas para empresas",
      metaDescription: "Estruturas metálicas, perfis sob medida e energia solar."
    });

    assert.equal(parsed.socialTitle, undefined);
    assert.equal(parsed.socialDescription, undefined);
    assert.equal(parsed.canonicalUrl, undefined);
    assert.equal(parsed.noFollow, false);
    assert.equal(parsed.noIndex, false);
  });

  it("accepts a relative canonical path and an absolute http(s) URL", () => {
    const relative = pageSeoEntrySchema.parse({
      metaTitle: "Serviços",
      metaDescription: "Soluções Tessa para estruturas metálicas industriais.",
      canonicalUrl: "/Servicos/Estrutura-Carport/"
    });
    assert.equal(relative.canonicalUrl, "/servicos/estrutura-carport");

    const absolute = pageSeoEntrySchema.parse({
      metaTitle: "Serviços",
      metaDescription: "Soluções Tessa para estruturas metálicas industriais.",
      canonicalUrl: "https://origem.example/artigo"
    });
    assert.equal(absolute.canonicalUrl, "https://origem.example/artigo");
  });

  it("rejects a canonical path without a leading slash or with a query string", () => {
    const base = {
      metaTitle: "Serviços",
      metaDescription: "Soluções Tessa para estruturas metálicas industriais."
    };

    assert.equal(
      pageSeoEntrySchema.safeParse({ ...base, canonicalUrl: "servicos/carport" }).success,
      false
    );
    assert.equal(
      pageSeoEntrySchema.safeParse({
        ...base,
        canonicalUrl: "/servicos/carport?utm=1"
      }).success,
      false
    );
  });

  it("rejects a twitter handle without @ and accepts @handle", () => {
    assert.equal(
      seoDefaultsSchema.safeParse({
        ...seoDefaults,
        twitterSite: "tessaeng"
      }).success,
      false
    );

    const parsed = seoDefaultsSchema.parse({
      ...seoDefaults,
      twitterSite: "@tessaeng"
    });
    assert.equal(parsed.twitterSite, "@tessaeng");
  });

  it("rejects social title and description over the Yoast-style limits", () => {
    const base = {
      metaTitle: "Serviços",
      metaDescription: "Soluções Tessa para estruturas metálicas industriais."
    };

    assert.equal(
      pageSeoEntrySchema.safeParse({
        ...base,
        socialTitle: "a".repeat(MAX_SEO_SOCIAL_TITLE_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      pageSeoEntrySchema.safeParse({
        ...base,
        socialDescription: "a".repeat(MAX_SEO_SOCIAL_DESCRIPTION_LENGTH + 1)
      }).success,
      false
    );

    const parsed = pageSeoEntrySchema.parse({
      ...base,
      socialTitle: "Título social",
      socialDescription: "Descrição social da página."
    });
    assert.equal(parsed.socialTitle, "Título social");
    assert.equal(parsed.socialDescription, "Descrição social da página.");
  });

  it("omits empty social fields and preserves them when publishing", () => {
    const withSocial = {
      home: {
        metaTitle: "Estruturas metálicas para empresas",
        metaDescription:
          "Estruturas metálicas, perfis sob medida e energia solar para empresas.",
        socialTitle: "Estruturas Tessa",
        socialDescription: "Engenharia aplicada em aço galvanizado.",
        canonicalUrl: "/quem-somos",
        noIndex: false,
        noFollow: true
      }
    };

    const parsed = pageSeoSchema.parse(withSocial);
    assert.equal(parsed.home?.socialTitle, "Estruturas Tessa");
    assert.equal(parsed.home?.noFollow, true);

    const omitted = pageSeoEntrySchema.parse({
      metaTitle: "Blog",
      metaDescription: "Artigos técnicos sobre estruturas metálicas e energia solar.",
      socialTitle: "   "
    });
    assert.equal(omitted.socialTitle, undefined);

    const published = sanitizeContentForPublish({ pageSeo: withSocial });
    const publishedPages = (published as Record<string, unknown>).pageSeo as typeof withSocial;
    assert.equal(publishedPages.home.socialTitle, "Estruturas Tessa");
    assert.equal(publishedPages.home.canonicalUrl, "/quem-somos");
    assert.equal(publishedPages.home.noFollow, true);
  });

  it("extracts social copy and keeps canonical identical after the translation round-trip", () => {
    const content = {
      pageSeo: {
        home: {
          metaTitle: "Estruturas metálicas para empresas",
          metaDescription:
            "Estruturas metálicas, perfis sob medida e energia solar para empresas.",
          socialTitle: "Estruturas Tessa para o feed",
          socialDescription: "Aço galvanizado e engenharia aplicada.",
          canonicalUrl: "/servicos/estrutura-carport",
          noIndex: false,
          noFollow: true
        }
      },
      seoDefaults: {
        ...seoDefaults,
        twitterSite: "@tessaeng"
      }
    };

    const extracted = extractLandingItems(content);
    const ids = extracted.map((item) => item.id);
    assert.equal(ids.includes("seo.page.home.socialTitle"), true);
    assert.equal(ids.includes("seo.page.home.socialDescription"), true);
    assert.equal(ids.includes("seo.page.home.canonicalUrl"), false);
    assert.equal(
      extracted.some((item) => item.text.includes("/servicos/estrutura-carport")),
      false
    );
    assert.equal(
      extracted.some((item) => item.text.includes("@tessaeng")),
      false
    );

    const localized = applyLandingItems(content, {
      "seo.page.home.socialTitle": "Tessa structures for the feed",
      "seo.page.home.socialDescription": "Galvanized steel and applied engineering."
    });
    const localizedPages = localized.pageSeo as typeof content.pageSeo;
    const localizedDefaults = localized.seoDefaults as typeof content.seoDefaults;
    assert.equal(localizedPages.home.socialTitle, "Tessa structures for the feed");
    assert.equal(
      localizedPages.home.canonicalUrl,
      "/servicos/estrutura-carport"
    );
    assert.equal(localizedPages.home.noFollow, true);
    assert.equal(localizedDefaults.twitterSite, "@tessaeng");
  });

  it("requires authentication for the generated SEO admin routes", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
    process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
    process.env.MASTER_SETUP_KEY ??= "test-setup-key";

    const { adminContentRouter } = await import("../content.admin-router.js");
    for (const path of [
      "/seo-defaults",
      "/page-seo",
      "/seo-defaults/og-image",
      "/page-seo/home/og-image"
    ]) {
      for (const method of path.includes("og-image")
        ? ["DELETE", "POST"]
        : ["DELETE", "GET", "POST", "PUT"]) {
        const response = await adminContentRouter.request(path, { method });
        assert.equal(response.status, 401);
      }
    }
  });
});
