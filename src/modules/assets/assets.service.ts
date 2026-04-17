import { extname } from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { env } from "../../env.js";
import { badRequest, internalServerError, payloadTooLarge } from "../../lib/http.js";
import { allowedImageMimeTypeSchema, allowedImageMimeTypes } from "./assets.schemas.js";

type PreparedImageAsset = {
  contentType: "image/webp";
  body: Blob;
  sizeBytes: number;
  originalFilename: string;
};

export const CLIENT_LOGO_PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]);

type AllowedImageMimeType = (typeof allowedImageMimeTypes)[number];

const mimeTypeByExtension: Record<string, AllowedImageMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function ensureBlobToken(): string {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    internalServerError("Upload de assets não configurado.");
  }

  return env.BLOB_READ_WRITE_TOKEN;
}

function resolveAllowedImageMimeType(file: File): AllowedImageMimeType | null {
  const mimeTypeResult = allowedImageMimeTypeSchema.safeParse(file.type);
  if (mimeTypeResult.success) {
    return mimeTypeResult.data;
  }

  const extension = extname(file.name).toLowerCase();
  return mimeTypeByExtension[extension] ?? null;
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

  const resolvedMimeType = resolveAllowedImageMimeType(file);
  if (!resolvedMimeType) {
    badRequest("Tipo de arquivo inválido. Envie uma imagem JPG, PNG ou WebP.");
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    if (resolvedMimeType === "image/webp") {
      return {
        contentType: "image/webp",
        body: new Blob([new Uint8Array(inputBuffer)], { type: "image/webp" }),
        sizeBytes: inputBuffer.byteLength,
        originalFilename: file.name
      };
    }

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

export async function prepareClientLogoAsset(
  file: File,
  maxBytes: number
): Promise<PreparedImageAsset> {
  if (!file.name) {
    badRequest("Arquivo inválido.");
  }

  if (file.size === 0) {
    badRequest("Arquivo vazio.");
  }

  if (file.size > maxBytes) {
    payloadTooLarge(
      `Arquivo maior do que o permitido. Limite: ${Math.floor(maxBytes / 1024)} KB.`
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  if (
    inputBuffer.length < CLIENT_LOGO_PNG_SIGNATURE.length ||
    !inputBuffer.subarray(0, CLIENT_LOGO_PNG_SIGNATURE.length).equals(CLIENT_LOGO_PNG_SIGNATURE)
  ) {
    badRequest("Arquivo inválido. Envie um PNG válido.");
  }

  if (file.type && file.type !== "image/png") {
    badRequest("Tipo de arquivo inválido. Envie um logo em PNG.");
  }

  try {
    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .webp({ lossless: true, effort: 6 })
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
