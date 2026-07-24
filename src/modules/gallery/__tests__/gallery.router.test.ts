import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.TRANSLATION_ENABLED = "false";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";

function makeVideoRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-24T12:00:00.000Z");
  return {
    id: "video-1",
    kind: "video" as const,
    alt: "Linha de produção",
    caption: "Tour da fábrica",
    categorySlug: "carport",
    order: 0,
    imageUrl: null,
    imagePathname: null,
    imageMimeType: null,
    imageSizeBytes: null,
    imageOriginalFilename: null,
    youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
    createdAt: now,
    updatedAt: now,
    createdById: "user-1",
    ...overrides
  };
}

function makePhotoRecord(overrides: Record<string, unknown> = {}) {
  return makeVideoRecord({
    id: "photo-1",
    kind: "photo",
    youtubeUrl: null,
    imageUrl: "https://cdn.example.com/gallery/photos/foto.webp",
    imagePathname: "gallery/photos/foto.webp",
    imageMimeType: "image/webp",
    imageSizeBytes: 1200,
    imageOriginalFilename: "foto.jpg",
    ...overrides
  });
}

async function loadRouterWithAuthStub() {
  const [{ galleryRouter }, { createAccessToken }, { prisma }] = await Promise.all([
    import("../gallery.router.js"),
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

  const token = await createAccessToken({
    id: "user-1",
    email: "admin@tessa.com.br",
    role: "ADMIN"
  });

  return { galleryRouter, token, prisma };
}

describe("gallery router", () => {
  it("requires authentication for creating videos", async () => {
    const { galleryRouter } = await import("../gallery.router.js");
    const response = await galleryRouter.request("/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
        alt: "Vídeo"
      })
    });
    assert.equal(response.status, 401);
  });

  it("rejects invalid YouTube URLs on create", async () => {
    const { galleryRouter, token } = await loadRouterWithAuthStub();
    const response = await galleryRouter.request("/videos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        youtubeUrl: "https://example.com/video",
        alt: "Vídeo inválido"
      })
    });
    assert.equal(response.status, 400);
  });

  it("creates a video and exposes it on the public list immediately", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();
    const created = makeVideoRecord();
    let countCalls = 0;

    Object.defineProperty(prisma.galleryMediaItem, "count", {
      configurable: true,
      value: async () => {
        countCalls += 1;
        return 0;
      }
    });
    Object.defineProperty(prisma.landingPage, "findUnique", {
      configurable: true,
      value: async () => ({
        status: "published",
        publishedContent: { categories: [{ slug: "carport" }] }
      })
    });
    Object.defineProperty(prisma.galleryMediaItem, "findFirst", {
      configurable: true,
      value: async () => null
    });
    Object.defineProperty(prisma.galleryMediaItem, "create", {
      configurable: true,
      value: async () => created
    });
    Object.defineProperty(prisma.galleryMediaItem, "findMany", {
      configurable: true,
      value: async () => [created]
    });

    const createResponse = await galleryRouter.request("/videos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        youtubeUrl: created.youtubeUrl,
        alt: created.alt,
        caption: created.caption,
        categorySlug: created.categorySlug
      })
    });

    assert.equal(createResponse.status, 201);
    assert.equal(countCalls, 1);
    const createdBody = (await createResponse.json()) as {
      item: { kind: string; youtubeVideoId: string | null };
    };
    assert.equal(createdBody.item.kind, "video");
    assert.equal(createdBody.item.youtubeVideoId, "EeLYcZsdYrw");

    const publicResponse = await galleryRouter.request("/?kind=video");
    assert.equal(publicResponse.status, 200);
    const publicBody = (await publicResponse.json()) as {
      items: Array<{ id: string; kind: string }>;
    };
    assert.equal(publicBody.items.length, 1);
    assert.equal(publicBody.items[0]?.id, "video-1");
  });

  it("rejects creating more videos than the hard limit", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();

    Object.defineProperty(prisma.galleryMediaItem, "count", {
      configurable: true,
      value: async () => 60
    });

    const response = await galleryRouter.request("/videos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
        alt: "Vídeo extra"
      })
    });

    assert.equal(response.status, 409);
  });

  it("rejects optional category slugs that are not published", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();

    Object.defineProperty(prisma.galleryMediaItem, "count", {
      configurable: true,
      value: async () => 0
    });
    Object.defineProperty(prisma.landingPage, "findUnique", {
      configurable: true,
      value: async () => ({
        status: "published",
        publishedContent: { categories: [{ slug: "carport" }] }
      })
    });

    const response = await galleryRouter.request("/videos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        youtubeUrl: "https://www.youtube.com/watch?v=EeLYcZsdYrw",
        alt: "Vídeo",
        categorySlug: "categoria-inexistente"
      })
    });

    assert.equal(response.status, 400);
  });

  it("reorders videos independently and returns the new order", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();
    const first = makeVideoRecord({ id: "video-1", order: 0 });
    const second = makeVideoRecord({ id: "video-2", order: 1, alt: "Segundo" });
    const updates: Array<{ id: string; order: number }> = [];

    let findManyCalls = 0;
    Object.defineProperty(prisma.galleryMediaItem, "findMany", {
      configurable: true,
      value: async () => {
        findManyCalls += 1;
        if (findManyCalls === 1) {
          return [{ id: "video-1" }, { id: "video-2" }];
        }
        return [
          { ...second, order: 0 },
          { ...first, order: 1 }
        ];
      }
    });
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      value: async (operations: Promise<unknown>[]) => Promise.all(operations)
    });
    Object.defineProperty(prisma.galleryMediaItem, "update", {
      configurable: true,
      value: async ({ where, data }: { where: { id: string }; data: { order: number } }) => {
        updates.push({ id: where.id, order: data.order });
        return makeVideoRecord({ id: where.id, order: data.order });
      }
    });

    const response = await galleryRouter.request("/reorder", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        kind: "video",
        orderedIds: ["video-2", "video-1"]
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(updates, [
      { id: "video-2", order: 0 },
      { id: "video-1", order: 1 }
    ]);
  });

  it("rejects non-multipart bodies on photo upload", async () => {
    const { galleryRouter, token } = await loadRouterWithAuthStub();
    const response = await galleryRouter.request("/photos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ alt: "Foto" })
    });
    assert.equal(response.status, 400);
  });

  it("deletes an item and removes it from the public list", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();
    const photo = makePhotoRecord();
    let deletedId: string | null = null;

    Object.defineProperty(prisma.galleryMediaItem, "findUnique", {
      configurable: true,
      value: async () => photo
    });
    Object.defineProperty(prisma.asset, "deleteMany", {
      configurable: true,
      value: async () => ({ count: 1 })
    });
    Object.defineProperty(prisma.galleryMediaItem, "delete", {
      configurable: true,
      value: async ({ where }: { where: { id: string } }) => {
        deletedId = where.id;
        return photo;
      }
    });
    Object.defineProperty(prisma.translation, "deleteMany", {
      configurable: true,
      value: async () => ({ count: 2 })
    });
    Object.defineProperty(prisma.asset, "findMany", {
      configurable: true,
      // Keep the blob referenced so the test does not call Vercel Blob delete.
      value: async () => [
        {
          url: photo.imageUrl,
          entityType: "other",
          entityId: "still-in-use"
        }
      ]
    });
    Object.defineProperty(prisma.galleryMediaItem, "findMany", {
      configurable: true,
      value: async () => []
    });

    const response = await galleryRouter.request(`/${photo.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.status, 200);
    assert.equal(deletedId, photo.id);

    const publicResponse = await galleryRouter.request("/");
    assert.equal(publicResponse.status, 200);
    const body = (await publicResponse.json()) as { items: unknown[] };
    assert.equal(body.items.length, 0);
  });

  it("rejects mutating kind via update payload by ignoring unknown kind fields", async () => {
    const { galleryRouter, token, prisma } = await loadRouterWithAuthStub();
    const video = makeVideoRecord();

    Object.defineProperty(prisma.galleryMediaItem, "findUnique", {
      configurable: true,
      value: async () => video
    });
    Object.defineProperty(prisma.galleryMediaItem, "update", {
      configurable: true,
      value: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal("kind" in data, false);
        return { ...video, alt: (data.alt as string) ?? video.alt };
      }
    });

    const response = await galleryRouter.request(`/${video.id}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        alt: "Novo alt",
        kind: "photo"
      })
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as { item: { kind: string; alt: string } };
    assert.equal(body.item.kind, "video");
    assert.equal(body.item.alt, "Novo alt");
  });
});
