import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../env.js";
import { badRequest, internalServerError } from "../../lib/http.js";

const STATE_TTL_MS = 10 * 60 * 1000;
const AES_ALGORITHM = "aes-256-gcm";

function requireEncryptionKey(): Buffer {
  if (!env.INSTAGRAM_TOKEN_ENCRYPTION_KEY) {
    internalServerError("Criptografia do token do Instagram não configurada.");
  }

  const key = Buffer.from(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY, "utf8");
  if (key.byteLength < 32) {
    internalServerError("INSTAGRAM_TOKEN_ENCRYPTION_KEY precisa ter ao menos 32 caracteres.");
  }

  return key.subarray(0, 32);
}

function requireJwtSecret(): string {
  return env.JWT_SECRET;
}

export function encryptSecret(plainText: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const key = requireEncryptionKey();
  const [ivPart, tagPart, dataPart] = payload.split(".");

  if (!ivPart || !tagPart || !dataPart) {
    badRequest("Token criptografado inválido.");
  }

  const decipher = createDecipheriv(AES_ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

interface OAuthStatePayload {
  userId: string;
  nonce: string;
  exp: number;
}

export function createOAuthState(userId: string): string {
  const payload: OAuthStatePayload = {
    userId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", requireJwtSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyOAuthState(state: string): { userId: string } {
  const [body, signature] = state.split(".");
  if (!body || !signature) {
    badRequest("State OAuth inválido.");
  }

  const expected = createHmac("sha256", requireJwtSecret()).update(body).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    badRequest("State OAuth inválido.");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    badRequest("State OAuth inválido.");
  }

  if (!payload.userId || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    badRequest("State OAuth expirado ou inválido.");
  }

  return { userId: payload.userId };
}
