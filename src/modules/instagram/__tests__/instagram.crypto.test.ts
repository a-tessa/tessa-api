import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-at-least-16";
process.env.MASTER_SETUP_KEY ??= "test-master-key";
process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY ??=
  "test-instagram-encryption-key-32-characters";

const {
  createOAuthState,
  decryptSecret,
  encryptSecret,
  verifyOAuthState
} = await import("../instagram.crypto.js");

describe("instagram.crypto", () => {
  it("encrypts and decrypts secrets round-trip", () => {
    const plain = "IGQVJexample-access-token";
    const encrypted = encryptSecret(plain);
    assert.notEqual(encrypted, plain);
    assert.equal(decryptSecret(encrypted), plain);
  });

  it("creates and verifies oauth state", () => {
    const state = createOAuthState("user_123");
    const verified = verifyOAuthState(state);
    assert.equal(verified.userId, "user_123");
  });

  it("rejects tampered oauth state", () => {
    const state = createOAuthState("user_123");
    const tampered = `${state.slice(0, -2)}aa`;
    assert.throws(() => verifyOAuthState(tampered));
  });
});
