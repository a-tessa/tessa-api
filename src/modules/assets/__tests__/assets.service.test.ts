import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";
process.env.TRANSLATION_ENABLED = "false";

const { prepareImageBuffer } = await import("../assets.service.js");

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 140 }
    }
  })
    .jpeg()
    .toBuffer();
}

describe("prepareImageBuffer", () => {
  it("shrinks a wide photo so the longest edge is 1920 px", async () => {
    const prepared = await prepareImageBuffer(await jpeg(2400, 1600), "foto-grande.jpg");
    const metadata = await sharp(Buffer.from(await prepared.body.arrayBuffer())).metadata();

    assert.equal(prepared.contentType, "image/webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1920);
    assert.equal(metadata.height, 1280);
    assert.equal(prepared.sizeBytes, prepared.body.size);
  });

  it("keeps a photo that is already smaller than 1920 px", async () => {
    const prepared = await prepareImageBuffer(await jpeg(80, 60), "foto-pequena.jpg");
    const metadata = await sharp(Buffer.from(await prepared.body.arrayBuffer())).metadata();

    assert.equal(metadata.width, 80);
    assert.equal(metadata.height, 60);
  });
});
