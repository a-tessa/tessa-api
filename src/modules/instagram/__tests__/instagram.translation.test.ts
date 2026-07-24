import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyInstagramItems,
  extractInstagramItems
} from "../../translation/translation.extract.js";

describe("instagram translation extract", () => {
  it("extracts caption and alt text", () => {
    const items = extractInstagramItems({
      caption: "Galpão em aço galvanizado",
      altText: "Estrutura metálica vista frontal"
    });

    assert.deepEqual(items, [
      {
        id: "instagram.caption",
        text: "Galpão em aço galvanizado",
        format: "plain"
      },
      {
        id: "instagram.altText",
        text: "Estrutura metálica vista frontal",
        format: "plain"
      }
    ]);
  });

  it("falls back to source when translation map is incomplete", () => {
    const localized = applyInstagramItems(
      {
        caption: "Original",
        altText: "Alt original"
      },
      {
        "instagram.caption": "Translated"
      }
    );

    assert.equal(localized.caption, "Translated");
    assert.equal(localized.altText, "Alt original");
  });
});
