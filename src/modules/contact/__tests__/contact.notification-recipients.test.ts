import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.TRANSLATION_ENABLED = "false";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";

async function loadRouterWithAuthStub() {
  const [{ contactRouter }, { createAccessToken }, { prisma }] = await Promise.all([
    import("../contact.router.js"),
    import("../../../lib/auth.js"),
    import("../../../lib/prisma.js")
  ]);

  Object.defineProperty(prisma.user, "findUnique", {
    configurable: true,
    value: async () => ({
      id: "user-1",
      email: "admin@tessa.com.br",
      role: "ADMIN",
      isActive: true
    })
  });

  Object.defineProperty(prisma.user, "findMany", {
    configurable: true,
    value: async () => []
  });

  const token = await createAccessToken({
    id: "user-1",
    email: "admin@tessa.com.br",
    role: "ADMIN"
  });

  return { contactRouter, token, prisma };
}

function stubSuggestedUsers(
  prisma: Awaited<ReturnType<typeof loadRouterWithAuthStub>>["prisma"],
  users: { id: string; name: string; email: string }[]
) {
  Object.defineProperty(prisma.user, "findMany", {
    configurable: true,
    value: async () => users
  });
}

function stubRecipients(
  prisma: Awaited<ReturnType<typeof loadRouterWithAuthStub>>["prisma"],
  emails: string[]
) {
  const now = new Date("2026-08-13T12:00:00.000Z");

  Object.defineProperty(prisma.contactNotificationRecipient, "findMany", {
    configurable: true,
    value: async () =>
      emails.map((email, index) => ({
        id: `recipient-${String(index)}`,
        email,
        name: null,
        sortOrder: index,
        createdAt: now,
        updatedAt: now
      }))
  });
}

describe("replaceContactNotificationRecipientsSchema", () => {
  it("normalizes emails and turns blank names into null", async () => {
    const { replaceContactNotificationRecipientsSchema } = await import(
      "../contact.schemas.js"
    );

    const parsed = replaceContactNotificationRecipientsSchema.parse({
      recipients: [
        { email: "  Comercial@Tessa.com.BR ", name: "  Comercial  " },
        { email: "diretoria@tessa.com.br", name: "   " }
      ]
    });

    assert.deepEqual(parsed.recipients, [
      { email: "comercial@tessa.com.br", name: "Comercial" },
      { email: "diretoria@tessa.com.br", name: null }
    ]);
  });

  it("accepts an empty list so the environment fallback takes over", async () => {
    const { replaceContactNotificationRecipientsSchema } = await import(
      "../contact.schemas.js"
    );

    assert.deepEqual(
      replaceContactNotificationRecipientsSchema.parse({ recipients: [] }).recipients,
      []
    );
  });

  it("rejects duplicated emails regardless of casing", async () => {
    const { replaceContactNotificationRecipientsSchema } = await import(
      "../contact.schemas.js"
    );

    const result = replaceContactNotificationRecipientsSchema.safeParse({
      recipients: [
        { email: "comercial@tessa.com.br" },
        { email: "COMERCIAL@tessa.com.br" }
      ]
    });

    assert.equal(result.success, false);
  });

  it("rejects more recipients than the allowed maximum", async () => {
    const { MAX_CONTACT_NOTIFICATION_RECIPIENTS, replaceContactNotificationRecipientsSchema } =
      await import("../contact.schemas.js");

    const recipients = Array.from(
      { length: MAX_CONTACT_NOTIFICATION_RECIPIENTS + 1 },
      (_, index) => ({ email: `contato${String(index)}@tessa.com.br` })
    );

    assert.equal(
      replaceContactNotificationRecipientsSchema.safeParse({ recipients }).success,
      false
    );
  });
});

describe("resolveContactNotificationRecipients", () => {
  it("falls back to CONTACT_NOTIFICATION_EMAIL when no recipient is registered", async () => {
    const { prisma } = await loadRouterWithAuthStub();
    stubRecipients(prisma, []);

    const [{ resolveContactNotificationRecipients }, { env }] = await Promise.all([
      import("../contact.email.js"),
      import("../../../env.js")
    ]);

    assert.deepEqual(await resolveContactNotificationRecipients(), [
      env.CONTACT_NOTIFICATION_EMAIL
    ]);
  });

  it("uses every registered recipient once the list is filled", async () => {
    const { prisma } = await loadRouterWithAuthStub();
    stubRecipients(prisma, ["comercial@tessa.com.br", "diretoria@tessa.com.br"]);

    const { resolveContactNotificationRecipients } = await import("../contact.email.js");

    assert.deepEqual(await resolveContactNotificationRecipients(), [
      "comercial@tessa.com.br",
      "diretoria@tessa.com.br"
    ]);
  });
});

describe("contact notification recipients router", () => {
  it("requires authentication", async () => {
    const { contactRouter } = await import("../contact.router.js");
    const response = await contactRouter.request("/admin/notification-recipients");

    assert.equal(response.status, 401);
  });

  it("returns the registered list along with the environment fallback", async () => {
    const { contactRouter, token, prisma } = await loadRouterWithAuthStub();
    stubRecipients(prisma, ["comercial@tessa.com.br"]);

    const response = await contactRouter.request("/admin/notification-recipients", {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = (await response.json()) as {
      recipients: { email: string }[];
      suggestedUsers: { email: string }[];
      fallbackEmail: string;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.recipients.map((recipient) => recipient.email),
      ["comercial@tessa.com.br"]
    );
    assert.deepEqual(body.suggestedUsers, []);
    assert.equal(typeof body.fallbackEmail, "string");
  });

  it("returns active users as recipient suggestions", async () => {
    const { contactRouter, token, prisma } = await loadRouterWithAuthStub();
    stubRecipients(prisma, []);
    stubSuggestedUsers(prisma, [
      { id: "user-2", name: "Ana Souza", email: "ana@tessa.com.br" },
      { id: "user-1", name: "Carlos Lima", email: "carlos@tessa.com.br" }
    ]);

    const response = await contactRouter.request("/admin/notification-recipients", {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = (await response.json()) as {
      suggestedUsers: { id: string; name: string; email: string }[];
    };

    assert.equal(response.status, 200);
    assert.deepEqual(body.suggestedUsers, [
      { id: "user-2", name: "Ana Souza", email: "ana@tessa.com.br" },
      { id: "user-1", name: "Carlos Lima", email: "carlos@tessa.com.br" }
    ]);
  });

  it("rejects an invalid email on save", async () => {
    const { contactRouter, token } = await loadRouterWithAuthStub();

    const response = await contactRouter.request("/admin/notification-recipients", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ recipients: [{ email: "sem-arroba" }] })
    });

    assert.equal(response.status, 400);
  });
});
