import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-at-least-16";
process.env.MASTER_SETUP_KEY ??= "test-master-key";

const { fetchInstagramMe } = await import("../instagram.client.js");

describe("instagram.client", () => {
  it("requests only fields supported by the Facebook Login IG User", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const fields = url.searchParams.get("fields") ?? "";

      if (fields.includes("account_type")) {
        return Response.json(
          {
            error: {
              message: "(#100) Tried accessing nonexisting field (account_type)"
            }
          },
          { status: 400 }
        );
      }

      return Response.json({
        id: "17841400000000000",
        username: "tessa"
      });
    };

    try {
      const profile = await fetchInstagramMe(
        "17841400000000000",
        "access-token"
      );

      assert.deepEqual(profile, {
        userId: "17841400000000000",
        username: "tessa",
        accountType: null
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
