import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  RESULTS_SECTION_STAT_COUNT,
  resultsSectionSchema
} from "../content.schemas.js";

describe("resultsSectionSchema", () => {
  it("accepts exactly three non-negative integers", () => {
    assert.deepEqual(resultsSectionSchema.parse({ values: [7, 200, 20] }), {
      values: [7, 200, 20]
    });
  });

  it("rejects the wrong number of values", () => {
    assert.equal(resultsSectionSchema.safeParse({ values: [7, 200] }).success, false);
    assert.equal(
      resultsSectionSchema.safeParse({ values: [7, 200, 20, 1] }).success,
      false
    );
    assert.equal(RESULTS_SECTION_STAT_COUNT, 3);
  });

  it("rejects negatives and non-integers", () => {
    assert.equal(
      resultsSectionSchema.safeParse({ values: [-1, 200, 20] }).success,
      false
    );
    assert.equal(
      resultsSectionSchema.safeParse({ values: [7.5, 200, 20] }).success,
      false
    );
  });

  it("is optional on draft content", () => {
    assert.equal(draftContentSchema.parse({}).resultsSection, undefined);
  });
});
