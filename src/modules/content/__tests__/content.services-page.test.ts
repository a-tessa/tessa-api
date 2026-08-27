import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SERVICE_IMAGE_ALT_LENGTH,
  servicesPageItemSchema,
  servicesPageMutationSchema
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

const servicePage = {
  slug: "cobertura-industrial",
  title: "Cobertura industrial",
  category: "cobertura",
  subtitle: "Cobertura metálica para pátios industriais.",
  exampleVideoUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
  backgroundImageUrl: "https://blob.example/cobertura.webp",
  backgroundImageAlt: "Pátio industrial com cobertura metálica Tessa",
  images: [
    {
      imgUrl: "https://blob.example/cobertura-1.webp",
      alt: "Detalhe da tesoura metálica da cobertura industrial"
    }
  ],
  updatedAt: "2026-08-20T15:30:00.000Z"
};

describe("services page updatedAt", () => {
  it("keeps updatedAt on read and publish, and ignores it on mutation input", () => {
    const parsed = servicesPageItemSchema.parse(servicePage);
    assert.equal(parsed.updatedAt, "2026-08-20T15:30:00.000Z");

    const published = sanitizeContentForPublish({
      servicesPages: [servicePage]
    }) as { servicesPages: Array<{ updatedAt?: string }> };
    assert.equal(published.servicesPages[0]?.updatedAt, "2026-08-20T15:30:00.000Z");

    const mutation = servicesPageMutationSchema.parse({
      ...servicePage,
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    assert.equal("updatedAt" in mutation, false);
  });
});

describe("services page image alt", () => {
  it("keeps alt on read and publish for existing pages without alt", () => {
    const legacy = {
      slug: "carport",
      title: "Carport",
      category: "cobertura",
      subtitle: "Cobertura metálica para veículos.",
      exampleVideoUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
      backgroundImageUrl: "https://blob.example/carport.webp",
      images: [{ imgUrl: "https://blob.example/carport-1.webp" }]
    };

    const parsed = servicesPageItemSchema.parse(legacy);
    assert.equal(parsed.backgroundImageAlt, undefined);
    assert.equal(parsed.images[0]?.alt, undefined);

    const published = sanitizeContentForPublish({
      servicesPages: [legacy]
    }) as {
      servicesPages: Array<{
        backgroundImageAlt?: string;
        images: Array<{ alt?: string }>;
      }>;
    };
    assert.equal(published.servicesPages[0]?.backgroundImageAlt, undefined);
    assert.equal(published.servicesPages[0]?.images[0]?.alt, undefined);
  });

  it("requires alt on create and update", () => {
    assert.equal(
      servicesPageMutationSchema.safeParse({
        ...servicePage,
        backgroundImageAlt: undefined,
        images: [{ imgUrl: servicePage.images[0]?.imgUrl }]
      }).success,
      false
    );
    assert.equal(
      servicesPageMutationSchema.safeParse({
        ...servicePage,
        backgroundImageAlt: "a".repeat(MAX_SERVICE_IMAGE_ALT_LENGTH + 1)
      }).success,
      false
    );

    const parsed = servicesPageMutationSchema.parse(servicePage);
    assert.equal(parsed.backgroundImageAlt, servicePage.backgroundImageAlt);
    assert.equal(parsed.images[0]?.alt, servicePage.images[0]?.alt);
  });

  it("extracts and applies translated image alt", () => {
    const extracted = extractLandingItems({ servicesPages: [servicePage] });
    const ids = extracted.map((item) => item.id);

    assert.deepEqual(ids, [
      "service.cobertura-industrial.title",
      "service.cobertura-industrial.subtitle",
      "service.cobertura-industrial.backgroundImageAlt",
      "service.cobertura-industrial.image.0.alt"
    ]);

    const localized = applyLandingItems(
      { servicesPages: [servicePage] },
      {
        "service.cobertura-industrial.backgroundImageAlt":
          "Industrial yard with a Tessa steel canopy",
        "service.cobertura-industrial.image.0.alt":
          "Detail of the industrial canopy steel truss"
      }
    ) as {
      servicesPages: Array<{
        backgroundImageAlt?: string;
        images: Array<{ alt?: string }>;
      }>;
    };

    assert.equal(
      localized.servicesPages[0]?.backgroundImageAlt,
      "Industrial yard with a Tessa steel canopy"
    );
    assert.equal(
      localized.servicesPages[0]?.images[0]?.alt,
      "Detail of the industrial canopy steel truss"
    );
  });
});
