import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instagramSelectionInputSchema } from "../instagram.schemas.js";

describe("instagram selection", () => {
  const validSelection = {
    expectedUpdatedAt: "2026-07-23T19:00:00.000Z",
    primary: "media-primary",
    upperRight: "media-upper",
    lowerRight: "media-lower"
  };

  it("accepts three distinct named slots", () => {
    assert.equal(
      instagramSelectionInputSchema.safeParse(validSelection).success,
      true
    );
  });

  it("rejects repeated media", () => {
    const result = instagramSelectionInputSchema.safeParse({
      ...validSelection,
      lowerRight: validSelection.primary
    });

    assert.equal(result.success, false);
  });
});
