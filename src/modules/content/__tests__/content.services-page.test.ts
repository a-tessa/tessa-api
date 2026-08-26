import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  servicesPageItemSchema,
  servicesPageMutationSchema
} from "../content.schemas.js";
import { sanitizeContentForPublish } from "../content.utils.js";

process.env.TRANSLATION_ENABLED = "false";

const servicePage = {
  slug: "carport",
  title: "Carport",
  category: "cobertura",
  subtitle: "Cobertura metálica para veículos.",
  exampleVideoUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
  backgroundImageUrl: "https://blob.example/carport.webp",
  images: [{ imgUrl: "https://blob.example/carport-1.webp" }],
  updatedAt: "2026-08-20T15:30:00.000Z"
};

describe("services page updatedAt", () => {
  it("keeps updatedAt on read and publish, and ignores it on mutation input", () => {
    const parsed = servicesPageItemSchema.parse(servicePage);
    assert.equal(parsed.updatedAt, "2026-08-20T15:30:00.000Z");

    const published = sanitizeContentForPublish({
      servicesPages: [servicePage]
    }) as { servicesPages: Array<{ updatedAt?: string }> };
    assert.equal(published.servicesPages[0]?.updatedAt, "2026-08-20T15:30:00.000Z");

    const mutation = servicesPageMutationSchema.parse({
      ...servicePage,
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    assert.equal("updatedAt" in mutation, false);
  });
});
