import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { env } from "../../env.js";
import { badRequest, internalServerError, payloadTooLarge } from "../../lib/http.js";
import { allowedImageMimeTypeSchema } from "./assets.schemas.js";
import type { PreparedImageAsset } from "./assets.types.js";

function ensureBlobToken(): string {
  if (!env.TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN) {
    internalServerError("Upload de assets não configurado.");
  }

  return env.TESSA_BLOB_WRITE_TOKEN_READ_WRITE_TOKEN;
}

export async function prepareImageAsset(file: File): Promise<PreparedImageAsset> {
  if (!file.name) {
    badRequest("Arquivo inválido.");
  }

  if (file.size === 0) {
    badRequest("Arquivo vazio.");
  }

  if (file.size > env.ASSET_MAX_UPLOAD_BYTES) {
    payloadTooLarge(
      `Arquivo maior do que o permitido. Limite atual: ${env.ASSET_MAX_UPLOAD_BYTES} bytes.`
    );
  }

  const mimeTypeResult = allowedImageMimeTypeSchema.safeParse(file.type);
  if (!mimeTypeResult.success) {
    badRequest("Tipo de arquivo inválido. Envie uma imagem JPG, PNG ou WebP.");
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .webp({ quality: 82 })
      .toBuffer();

    return {
      contentType: "image/webp",
      body: new Blob([new Uint8Array(outputBuffer)], { type: "image/webp" }),
      sizeBytes: outputBuffer.byteLength,
      originalFilename: file.name
    };
  } catch {
    badRequest("Não foi possível processar a imagem enviada.");
  }
}

export async function uploadPublicAsset(
  pathname: string,
  asset: PreparedImageAsset
) {
  const token = ensureBlobToken();

  return put(pathname, asset.body, {
    access: "public",
    contentType: asset.contentType,
    token
  });
}

export async function deleteBlobAsset(url: string) {
  const token = ensureBlobToken();
  await del(url, { token });
}
