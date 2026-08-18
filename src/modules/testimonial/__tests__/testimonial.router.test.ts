import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.TRANSLATION_ENABLED = "false";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";

describe("testimonial public POST", () => {
  it("returns 400 when multipart Content-Type has no boundary", async () => {
    const { app } = await import("../../../app.js");

    const response = await app.request("/api/testimonials", {
      method: "POST",
      headers: { "content-type": "multipart/form-data" },
      body: "authorName=Diagnostico&rating=5&comment=Envio sem boundary."
    });

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error?: string };
    assert.equal(payload.error, "Corpo da requisição inválido.");
  });
});
