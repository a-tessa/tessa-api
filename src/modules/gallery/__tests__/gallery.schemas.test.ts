import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGalleryPhotoFieldsSchema,
  createGalleryVideoSchema,
  MAX_GALLERY_ALT_LENGTH,
  MAX_GALLERY_CAPTION_LENGTH,
  reorderGalleryMediaSchema,
  updateGalleryMediaItemSchema
} from "../gallery.schemas.js";

describe("gallery media item schemas", () => {
  it("accepts a valid YouTube video payload with optional caption and category", () => {
    const parsed = createGalleryVideoSchema.parse({
      youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
      alt: "Linha de produção Tessa",
      caption: "Visita à fábrica",
      categorySlug: "carport"
    });

    assert.equal(parsed.youtubeUrl.includes("EeLYcZsdYrw"), true);
    assert.equal(parsed.categorySlug, "carport");
  });

  it("rejects an invalid YouTube URL", () => {
    assert.equal(
      createGalleryVideoSchema.safeParse({
        youtubeUrl: "https://example.com/not-youtube",
        alt: "Vídeo institucional"
      }).success,
      false
    );
  });

  it("treats empty category and caption as absent", () => {
    const parsed = createGalleryVideoSchema.parse({
      youtubeUrl: "https://youtu.be/EeLYcZsdYrw",
      alt: "Vídeo institucional",
      caption: "   ",
      categorySlug: ""
    });

    assert.equal(parsed.caption, undefined);
    assert.equal(parsed.categorySlug, null);
  });

  it("rejects alt/caption over limits and caption equal to alt", () => {
    assert.equal(
      createGalleryPhotoFieldsSchema.safeParse({
        alt: "a".repeat(MAX_GALLERY_ALT_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      createGalleryPhotoFieldsSchema.safeParse({
        alt: "Alt válido",
        caption: "c".repeat(MAX_GALLERY_CAPTION_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      createGalleryPhotoFieldsSchema.safeParse({
        alt: "Mesmo texto",
        caption: "Mesmo texto"
      }).success,
      false
    );
  });

  it("rejects youtubeUrl updates that are not YouTube", () => {
    assert.equal(
      updateGalleryMediaItemSchema.safeParse({
        youtubeUrl: "https://vimeo.com/123"
      }).success,
      false
    );
  });

  it("requires kind and at least one id when reordering", () => {
    assert.equal(
      reorderGalleryMediaSchema.safeParse({ kind: "photo", orderedIds: [] }).success,
      false
    );
    assert.deepEqual(
      reorderGalleryMediaSchema.parse({
        kind: "video",
        orderedIds: ["a", "b"]
      }),
      { kind: "video", orderedIds: ["a", "b"] }
    );
  });
});
