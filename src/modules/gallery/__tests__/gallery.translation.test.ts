import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGalleryMediaItems,
  extractGalleryMediaItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

describe("gallery media translation extract", () => {
  it("extracts alt and filled caption only", () => {
    const items = extractGalleryMediaItems({
      alt: "Linha de produção Tessa",
      caption: "Tour pela fábrica"
    });

    assert.deepEqual(items, [
      {
        id: "gallery.alt",
        text: "Linha de produção Tessa",
        format: "plain"
      },
      {
        id: "gallery.caption",
        text: "Tour pela fábrica",
        format: "plain"
      }
    ]);
  });

  it("omits empty caption and never includes URLs or image paths", () => {
    const items = extractGalleryMediaItems({
      alt: "Estrutura metálica",
      caption: null
    });

    assert.deepEqual(items, [
      {
        id: "gallery.alt",
        text: "Estrutura metálica",
        format: "plain"
      }
    ]);

    const serialized = JSON.stringify(items);
    assert.equal(serialized.includes("youtube"), false);
    assert.equal(serialized.includes("http"), false);
    assert.equal(serialized.includes("gallery/photos"), false);
  });

  it("falls back to Portuguese when the translation map is incomplete", () => {
    const localized = applyGalleryMediaItems(
      {
        alt: "Alt original",
        caption: "Legenda original"
      },
      {
        "gallery.alt": "Original alt"
      }
    );

    assert.equal(localized.alt, "Original alt");
    assert.equal(localized.caption, "Legenda original");
  });

  it("does not revive a removed caption from a stale translation map", () => {
    const localized = applyGalleryMediaItems(
      {
        alt: "Alt original",
        caption: null
      },
      {
        "gallery.alt": "Original alt",
        "gallery.caption": "Stale caption"
      }
    );

    assert.equal(localized.alt, "Original alt");
    assert.equal(localized.caption, null);
  });

  it("changes the extractable set when caption is removed or alt changes", () => {
    const withCaption = extractGalleryMediaItems({
      alt: "Alt A",
      caption: "Legenda"
    });
    const withoutCaption = extractGalleryMediaItems({
      alt: "Alt A",
      caption: null
    });
    const altChanged = extractGalleryMediaItems({
      alt: "Alt B",
      caption: "Legenda"
    });

    assert.equal(withCaption.length, 2);
    assert.equal(withoutCaption.length, 1);
    assert.equal(withoutCaption.some((item) => item.id === "gallery.caption"), false);
    assert.notEqual(altChanged.find((item) => item.id === "gallery.alt")?.text, "Alt A");
  });
});

describe("gallery public localization", () => {
  it("returns localized texts when a completed translation exists", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
    process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
    process.env.MASTER_SETUP_KEY ??= "test-setup-key";

    const [{ localizeGalleryMediaItems }, { prisma }] = await Promise.all([
      import("../../translation/translation.service.js"),
      import("../../../lib/prisma.js")
    ]);

    const source = {
      id: "gallery-1",
      kind: "video" as const,
      alt: "Linha de produção",
      caption: "Tour da fábrica",
      categorySlug: null,
      order: 0,
      imageUrl: null,
      imagePathname: null,
      imageMimeType: null,
      imageSizeBytes: null,
      imageOriginalFilename: null,
      youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
      createdAt: new Date("2026-07-24T12:00:00.000Z"),
      updatedAt: new Date("2026-07-24T12:00:00.000Z"),
      createdById: "user-1"
    };

    Object.defineProperty(prisma.translation, "findMany", {
      configurable: true,
      value: async () => [
        {
          entityId: "gallery-1",
          content: {
            "gallery.alt": "Production line",
            "gallery.caption": "Factory tour"
          }
        }
      ]
    });

    const [localized] = await localizeGalleryMediaItems([source], "en");
    assert.equal(localized?.alt, "Production line");
    assert.equal(localized?.caption, "Factory tour");
    assert.equal(localized?.youtubeUrl, source.youtubeUrl);
  });

  it("keeps Portuguese when localization is missing or failed", async () => {
    process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
    process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
    process.env.MASTER_SETUP_KEY ??= "test-setup-key";

    const [{ localizeGalleryMediaItems }, { prisma }] = await Promise.all([
      import("../../translation/translation.service.js"),
      import("../../../lib/prisma.js")
    ]);

    const source = {
      id: "gallery-2",
      kind: "photo" as const,
      alt: "Alt pt",
      caption: "Legenda pt",
      categorySlug: null,
      order: 0,
      imageUrl: "https://cdn.example.com/gallery/photos/foto.webp",
      imagePathname: "gallery/photos/foto.webp",
      imageMimeType: "image/webp",
      imageSizeBytes: 10,
      imageOriginalFilename: "foto.jpg",
      youtubeUrl: null,
      createdAt: new Date("2026-07-24T12:00:00.000Z"),
      updatedAt: new Date("2026-07-24T12:00:00.000Z"),
      createdById: "user-1"
    };

    Object.defineProperty(prisma.translation, "findMany", {
      configurable: true,
      value: async () => []
    });

    const [localized] = await localizeGalleryMediaItems([source], "es");
    assert.equal(localized?.alt, "Alt pt");
    assert.equal(localized?.caption, "Legenda pt");
  });

});
