import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  MAX_OPERATION_ALT_LENGTH,
  MAX_OPERATION_CAPTION_LENGTH,
  MAX_OPERATION_SECTION_IMAGES,
  MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH,
  operationSectionSchema,
  operationSectionWriteSchema
} from "../content.schemas.js";
import {
  assertOperationSectionReadyForPublish,
  sanitizeContentForPublish
} from "../content.utils.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

function makeImage(index: number, overrides: Record<string, unknown> = {}) {
  return {
    url: `https://cdn.example.com/operations/image-${index}.webp`,
    alt: `Texto alternativo ${index}`,
    ...overrides
  };
}

function makeSection(count: number, overrides: Record<string, unknown> = {}) {
  return {
    images: Array.from({ length: count }, (_, index) => makeImage(index, overrides))
  };
}

describe("operation section content", () => {
  it("keeps the section optional and accepts an empty draft gallery", () => {
    assert.equal(draftContentSchema.parse({}).operationSection, undefined);
    assert.deepEqual(operationSectionSchema.parse({ images: [] }), { images: [] });
    assert.deepEqual(operationSectionWriteSchema.parse({ images: [] }), { images: [] });
  });

  it("accepts up to 40 ordered images with url, required alt and optional caption", () => {
    const section = makeSection(MAX_OPERATION_SECTION_IMAGES, {
      caption: "Legenda opcional da operação"
    });
    assert.equal(operationSectionWriteSchema.parse(section).images.length, 40);
    assert.equal(operationSectionSchema.parse(section).images[0]?.caption, "Legenda opcional da operação");
  });

  it("rejects more than 40 images and enforces alt/caption limits", () => {
    assert.equal(
      operationSectionWriteSchema.safeParse(makeSection(MAX_OPERATION_SECTION_IMAGES + 1))
        .success,
      false
    );
    assert.equal(
      operationSectionWriteSchema.safeParse(
        makeSection(1, { alt: "a".repeat(MAX_OPERATION_ALT_LENGTH + 1) })
      ).success,
      false
    );
    assert.equal(
      operationSectionWriteSchema.safeParse(
        makeSection(1, { caption: "c".repeat(MAX_OPERATION_CAPTION_LENGTH + 1) })
      ).success,
      false
    );
    assert.equal(
      operationSectionWriteSchema.safeParse(makeSection(1, { alt: " " })).success,
      false
    );
  });

  it("rejects a caption that repeats the alternative text", () => {
    assert.equal(
      operationSectionWriteSchema.safeParse(
        makeSection(1, { alt: "Mesmo texto", caption: "Mesmo texto" })
      ).success,
      false
    );
  });

  it("treats an empty caption as absent and keeps legacy items without caption readable", () => {
    const withoutCaption = operationSectionSchema.parse({
      images: [makeImage(0)]
    });
    assert.equal(withoutCaption.images[0]?.caption, undefined);

    const emptyCaption = operationSectionSchema.parse({
      images: [makeImage(0, { caption: "   " })]
    });
    assert.equal(emptyCaption.images[0]?.caption, undefined);
  });

  it("keeps legacy published items without alt readable in stored content", () => {
    const legacy = operationSectionSchema.parse({
      images: [{ url: "https://cdn.example.com/legacy.webp" }]
    });
    assert.equal(legacy.images[0]?.alt, undefined);
    assert.equal(
      operationSectionWriteSchema.safeParse({
        images: [{ url: "https://cdn.example.com/legacy.webp" }]
      }).success,
      false
    );
  });

  it("allows publishing without the section and rejects a present section outside 6..40", () => {
    assert.doesNotThrow(() => assertOperationSectionReadyForPublish({}));
    assert.doesNotThrow(() =>
      assertOperationSectionReadyForPublish({
        operationSection: makeSection(MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH)
      })
    );
    assert.throws(
      () =>
        assertOperationSectionReadyForPublish({
          operationSection: makeSection(MIN_OPERATION_SECTION_IMAGES_FOR_PUBLISH - 1)
        }),
      /6/
    );
    assert.throws(
      () =>
        assertOperationSectionReadyForPublish({
          operationSection: makeSection(0)
        }),
      /6/
    );
  });

  it("requires valid alt text before publishing an altered operation section", () => {
    assert.throws(
      () =>
        assertOperationSectionReadyForPublish({
          operationSection: {
            images: Array.from({ length: 6 }, (_, index) => ({
              url: `https://cdn.example.com/operations/image-${index}.webp`
            }))
          }
        }),
      /alternativo/i
    );
  });

  it("publishes a valid Portuguese section as-is", () => {
    const operationSection = makeSection(6, { caption: "Legenda publicada" });
    const published = sanitizeContentForPublish({ operationSection });
    assert.deepEqual(
      (published as Record<string, unknown>).operationSection,
      operationSection
    );
  });

  it("extracts alt and filled captions for translation, preserving order", () => {
    const operationSection = {
      images: [
        makeImage(0, { caption: "Primeira legenda" }),
        makeImage(1),
        makeImage(2, { caption: "Terceira legenda" })
      ]
    };

    assert.deepEqual(extractLandingItems({ operationSection }), [
      {
        id: "operation.image.0.alt",
        text: "Texto alternativo 0",
        format: "plain"
      },
      {
        id: "operation.image.0.caption",
        text: "Primeira legenda",
        format: "plain"
      },
      {
        id: "operation.image.1.alt",
        text: "Texto alternativo 1",
        format: "plain"
      },
      {
        id: "operation.image.2.alt",
        text: "Texto alternativo 2",
        format: "plain"
      },
      {
        id: "operation.image.2.caption",
        text: "Terceira legenda",
        format: "plain"
      }
    ]);
  });

  it("applies localized alt/caption and falls back to Portuguese when missing", () => {
    const operationSection = {
      images: [
        makeImage(0, { caption: "Legenda PT" }),
        makeImage(1, { caption: "Outra legenda" })
      ]
    };

    const localized = applyLandingItems(
      { operationSection },
      {
        "operation.image.0.alt": "Alternative text 0",
        "operation.image.0.caption": "Caption EN"
      }
    );

    assert.deepEqual(localized.operationSection, {
      images: [
        {
          url: operationSection.images[0].url,
          alt: "Alternative text 0",
          caption: "Caption EN"
        },
        {
          url: operationSection.images[1].url,
          alt: "Texto alternativo 1",
          caption: "Outra legenda"
        }
      ]
    });
  });
});
