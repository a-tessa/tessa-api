import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  MAX_RESULTS_STATS,
  MIN_RESULTS_STATS,
  resultsSectionInputSchema,
  resultsSectionSchema
} from "../content.schemas.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

const resultsSection = {
  stats: [
    { value: 8_000_000, label: "de m² em estruturas metálicas" },
    { value: 600_000, label: "instalações realizadas no Brasil" },
    { value: 20, label: "anos de experiência em engenharia estrutural" }
  ]
};

describe("resultsSectionSchema", () => {
  it("accepts one to four stats with a raw value and label", () => {
    assert.deepEqual(resultsSectionInputSchema.parse(resultsSection), resultsSection);
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [{ value: 10, label: "projetos entregues" }]
      }).success,
      true
    );
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [
          { value: 1, label: "um" },
          { value: 2, label: "dois" },
          { value: 3, label: "três" },
          { value: 4, label: "quatro" }
        ]
      }).success,
      true
    );
    assert.equal(MIN_RESULTS_STATS, 1);
    assert.equal(MAX_RESULTS_STATS, 4);
  });

  it("rejects fewer than one or more than four stats", () => {
    assert.equal(
      resultsSectionInputSchema.safeParse({ stats: [] }).success,
      false
    );
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [
          { value: 1, label: "um" },
          { value: 2, label: "dois" },
          { value: 3, label: "três" },
          { value: 4, label: "quatro" },
          { value: 5, label: "cinco" }
        ]
      }).success,
      false
    );
  });

  it("rejects missing labels, negatives and non-integers", () => {
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [{ value: 7, label: " " }]
      }).success,
      false
    );
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [{ value: -1, label: "inválido" }]
      }).success,
      false
    );
    assert.equal(
      resultsSectionInputSchema.safeParse({
        stats: [{ value: 7.5, label: "inválido" }]
      }).success,
      false
    );
  });

  it("keeps previously stored compact and three-number payloads readable", () => {
    assert.deepEqual(
      resultsSectionSchema.parse({
        stats: [{ value: 7, suffix: "MI", label: "de m² em estruturas metálicas" }]
      }),
      {
        stats: [{ value: 7, suffix: "MI", label: "de m² em estruturas metálicas" }]
      }
    );
    assert.deepEqual(resultsSectionSchema.parse({ values: [7, 200, 20] }), {
      values: [7, 200, 20]
    });
    assert.equal(
      resultsSectionSchema.safeParse({ values: [7, 200] }).success,
      false
    );
  });

  it("is optional on draft content and does not extract legacy numbers", () => {
    assert.equal(draftContentSchema.parse({}).resultsSection, undefined);
    assert.deepEqual(extractLandingItems({ resultsSection: { values: [7, 200, 20] } }), []);
  });

  it("extracts only the Portuguese labels for translation", () => {
    const extracted = extractLandingItems({ resultsSection });

    assert.deepEqual(extracted, [
      {
        id: "results.stat.0.label",
        text: "de m² em estruturas metálicas",
        format: "plain"
      },
      {
        id: "results.stat.1.label",
        text: "instalações realizadas no Brasil",
        format: "plain"
      },
      {
        id: "results.stat.2.label",
        text: "anos de experiência em engenharia estrutural",
        format: "plain"
      }
    ]);
  });

  it("applies translated labels and keeps the raw numbers", () => {
    const localized = applyLandingItems(
      { resultsSection },
      {
        "results.stat.0.label": "m² in metal structures",
        "results.stat.1.label": "installations across Brazil"
      }
    );

    assert.deepEqual(localized.resultsSection, {
      stats: [
        { value: 8_000_000, label: "m² in metal structures" },
        { value: 600_000, label: "installations across Brazil" },
        {
          value: 20,
          label: "anos de experiência em engenharia estrutural"
        }
      ]
    });
  });
});
