import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  HEADING_IMAGE_PAGE_KEYS,
  headingImagePageKeySchema,
  headingImagesSchema
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";
import { extractLandingItems } from "../../translation/translation.extract.js";

describe("headingImages schema", () => {
  it("accepts an empty map and every known page key", () => {
    assert.deepEqual(headingImagesSchema.parse(undefined), {});
    assert.deepEqual(headingImagesSchema.parse({}), {});

    for (const pageKey of HEADING_IMAGE_PAGE_KEYS) {
      assert.equal(headingImagePageKeySchema.parse(pageKey), pageKey);
    }

    const headingImages = {
      "quem-somos": { url: "https://blob.example/quem-somos.webp" },
      blog: { url: "https://blob.example/blog.webp" }
    };

    assert.deepEqual(headingImagesSchema.parse(headingImages), headingImages);
  });

  it("rejects unknown page keys and empty urls", () => {
    assert.equal(
      headingImagesSchema.safeParse({
        home: { url: "https://blob.example/home.webp" }
      }).success,
      false
    );
    assert.equal(
      headingImagesSchema.safeParse({
        blog: { url: "   " }
      }).success,
      false
    );
  });

  it("survives draft parsing and publish sanitization", () => {
    const headingImages = {
      contato: { url: "https://blob.example/contato.webp" }
    };

    assert.deepEqual(draftContentSchema.parse({ headingImages }).headingImages, headingImages);

    const published = sanitizeContentForPublish({ headingImages });
    assert.deepEqual(
      (published as Record<string, unknown>).headingImages,
      headingImages
    );
  });

  it("is ignored by translation extraction", () => {
    const extracted = extractLandingItems({
      headingImages: {
        blog: { url: "https://blob.example/blog.webp" }
      },
      industrySection: {
        titlePrefix: "A força da",
        title: "indústria",
        subtitle: "Texto",
        videos: {
          "pt-BR": { url: "https://youtube.com/watch?v=pt" }
        }
      }
    });

    assert.equal(
      extracted.some((item) => item.id.includes("heading") || item.text.includes("blob.example")),
      false
    );
  });
});
