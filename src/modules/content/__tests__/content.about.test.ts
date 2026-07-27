import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aboutSectionSchema,
  draftContentSchema,
  MAX_ABOUT_BODY_LENGTH,
  MAX_ABOUT_HERO_TITLE_LENGTH
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";
import {
  applyLandingItems,
  extractLandingItems
} from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

const aboutSection = {
  heroTitle: "NÓS SOMOS A TESSA",
  videos: {
    "pt-BR": {
      url: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
      startSeconds: 8
    }
  },
  sideImage: {
    url: "https://example.com/about-side.webp",
    alt: "Equipe Tessa na indústria"
  },
  body: "Fundada em 2001, a Tessa especializa-se em estruturas metálicas galvanizadas.",
  mission: {
    title: "NOSSA MISSÃO",
    description: "Entregar estruturas metálicas com engenharia aplicada."
  },
  vision: {
    title: "VISÃO DA TESSA",
    description: "Ser referência nacional em estruturas metálicas."
  },
  values: {
    title: "NOSSOS VALORES",
    description: "Qualidade, segurança e proximidade com o cliente."
  }
};

describe("about section content", () => {
  it("accepts a valid section and keeps the section optional", () => {
    assert.equal(draftContentSchema.parse({}).aboutSection, undefined);
    assert.deepEqual(aboutSectionSchema.parse(aboutSection), aboutSection);
  });

  it("rejects invalid YouTube URLs and empty required fields", () => {
    assert.equal(
      aboutSectionSchema.safeParse({
        ...aboutSection,
        videos: { "pt-BR": { url: "https://example.com/not-youtube" } }
      }).success,
      false
    );
    assert.equal(
      aboutSectionSchema.safeParse({
        ...aboutSection,
        heroTitle: " "
      }).success,
      false
    );
    assert.equal(
      aboutSectionSchema.safeParse({
        ...aboutSection,
        heroTitle: "a".repeat(MAX_ABOUT_HERO_TITLE_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      aboutSectionSchema.safeParse({
        ...aboutSection,
        body: "a".repeat(MAX_ABOUT_BODY_LENGTH + 1)
      }).success,
      false
    );
  });

  it("publishes the Portuguese section as-is", () => {
    const published = sanitizeContentForPublish({ aboutSection });
    assert.deepEqual(
      (published as Record<string, unknown>).aboutSection,
      aboutSection
    );
  });

  it("extracts texts for translation but never video or image URLs", () => {
    const extracted = extractLandingItems({ aboutSection });

    assert.deepEqual(extracted, [
      { id: "about.heroTitle", text: aboutSection.heroTitle, format: "plain" },
      { id: "about.body", text: aboutSection.body, format: "plain" },
      {
        id: "about.sideImage.alt",
        text: aboutSection.sideImage.alt,
        format: "plain"
      },
      {
        id: "about.mission.title",
        text: aboutSection.mission.title,
        format: "plain"
      },
      {
        id: "about.mission.description",
        text: aboutSection.mission.description,
        format: "plain"
      },
      {
        id: "about.vision.title",
        text: aboutSection.vision.title,
        format: "plain"
      },
      {
        id: "about.vision.description",
        text: aboutSection.vision.description,
        format: "plain"
      },
      {
        id: "about.values.title",
        text: aboutSection.values.title,
        format: "plain"
      },
      {
        id: "about.values.description",
        text: aboutSection.values.description,
        format: "plain"
      }
    ]);

    const serialized = JSON.stringify(extracted);
    assert.equal(serialized.includes("youtube.com"), false);
    assert.equal(serialized.includes("example.com/about-side"), false);
  });

  it("applies translated texts while keeping media untouched", () => {
    const localized = applyLandingItems(
      { aboutSection },
      {
        "about.heroTitle": "WE ARE TESSA",
        "about.body": "Founded in 2001, Tessa specializes in galvanized steel structures.",
        "about.mission.title": "OUR MISSION"
      }
    );

    assert.deepEqual(localized.aboutSection, {
      ...aboutSection,
      heroTitle: "WE ARE TESSA",
      body: "Founded in 2001, Tessa specializes in galvanized steel structures.",
      mission: {
        ...aboutSection.mission,
        title: "OUR MISSION"
      }
    });
  });
});
