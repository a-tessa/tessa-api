import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftContentSchema,
  footerSectionSchema,
  MAX_FOOTER_NEWSLETTER_SUB_LENGTH,
  MAX_FOOTER_NEWSLETTER_TITLE_LENGTH
} from "../content.schemas.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

const footerSection = {
  newsletterTitle: "Receba novidades da Tessa",
  newsletterSub: "Conteúdos técnicos, novidades e soluções"
};

describe("footerSectionSchema", () => {
  it("accepts valid newsletter texts and keeps the section optional", () => {
    assert.equal(draftContentSchema.parse({}).footerSection, undefined);
    assert.deepEqual(footerSectionSchema.parse(footerSection), footerSection);
  });

  it("enforces required trimmed texts and max lengths", () => {
    assert.equal(
      footerSectionSchema.safeParse({
        ...footerSection,
        newsletterTitle: " "
      }).success,
      false
    );
    assert.equal(
      footerSectionSchema.safeParse({
        ...footerSection,
        newsletterSub: " "
      }).success,
      false
    );
    assert.equal(
      footerSectionSchema.safeParse({
        ...footerSection,
        newsletterTitle: "a".repeat(MAX_FOOTER_NEWSLETTER_TITLE_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      footerSectionSchema.safeParse({
        ...footerSection,
        newsletterSub: "a".repeat(MAX_FOOTER_NEWSLETTER_SUB_LENGTH + 1)
      }).success,
      false
    );
  });

  it("extracts newsletter texts for translation", () => {
    assert.deepEqual(extractLandingItems({ footerSection }), [
      {
        id: "footer.newsletterTitle",
        text: footerSection.newsletterTitle,
        format: "plain"
      },
      {
        id: "footer.newsletterSub",
        text: footerSection.newsletterSub,
        format: "plain"
      }
    ]);
  });

  it("applies translated newsletter texts", () => {
    const localized = applyLandingItems(
      { footerSection },
      {
        "footer.newsletterTitle": "Get Tessa news",
        "footer.newsletterSub": "Technical content, news and solutions"
      }
    );

    assert.deepEqual(localized.footerSection, {
      newsletterTitle: "Get Tessa news",
      newsletterSub: "Technical content, news and solutions"
    });
  });
});
