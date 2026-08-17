import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";
process.env.TRANSLATION_ENABLED = "false";

interface TestImage {
  url: string;
  alt: string;
}

interface TestAsset {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  sectionKey: string;
  fieldKey: string;
  slot: number | null;
  pathname: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  alt: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TestPage {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  draftContent: Record<string, unknown>;
  publishedContent: Record<string, unknown> | null;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  updatedById: string;
  publishedById: string | null;
}

function makeImages(prefix: string, count = 6): TestImage[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://cdn.example.com/${prefix}-${index}.webp`,
    alt: `${prefix} ${index}`
  }));
}

function makeAsset(image: TestImage, slot: number, id = `asset-${slot}`): TestAsset {
  const now = new Date("2026-07-25T12:00:00.000Z");
  return {
    id,
    kind: "image",
    entityType: "landingPage",
    entityId: "home",
    sectionKey: "operationSection",
    fieldKey: "images",
    slot,
    pathname: `landing-page/home/operation-section/${id}.webp`,
    url: image.url,
    mimeType: "image/webp",
    sizeBytes: 100,
    originalFilename: `${id}.jpg`,
    alt: image.alt,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now
  };
}

async function createOperationHarness() {
  const [{ adminContentRouter }, { publicContentRouter }, { createAccessToken }, { prisma }] =
    await Promise.all([
      import("../content.admin-router.js"),
      import("../content.public-router.js"),
      import("../../../lib/auth.js"),
      import("../../../lib/prisma.js")
    ]);
  const publishedImages = makeImages("published");
  const now = new Date("2026-07-25T12:00:00.000Z");
  let page: TestPage = {
    id: "page-1",
    slug: "home",
    title: "Home",
    status: "published",
    draftContent: { operationSection: { images: publishedImages } },
    publishedContent: { operationSection: { images: publishedImages } },
    publishedAt: now,
    updatedAt: now,
    createdAt: now,
    updatedById: "user-1",
    publishedById: "user-1"
  };
  let assets = publishedImages.map((image, index) => makeAsset(image, index));
  let nextAssetId = assets.length;

  Object.defineProperty(prisma.user, "findUnique", {
    configurable: true,
    value: async () => ({
      id: "user-1",
      email: "admin@tessa.com.br",
      role: "ADMIN",
      isActive: true
    })
  });
  Object.defineProperty(prisma.landingPage, "findUnique", {
    configurable: true,
    value: async () => page
  });
  Object.defineProperty(prisma.landingPage, "update", {
    configurable: true,
    value: async ({ data }: { data: Partial<TestPage> }) => {
      page = { ...page, ...data, updatedAt: new Date() };
      return page;
    }
  });
  Object.defineProperty(prisma.npsResponse, "findMany", {
    configurable: true,
    value: async () => []
  });
  Object.defineProperty(prisma.asset, "findMany", {
    configurable: true,
    value: async () => [...assets]
  });
  Object.defineProperty(prisma.asset, "deleteMany", {
    configurable: true,
    value: async ({ where }: { where: { url?: string | { in?: string[]; notIn?: string[] } } }) => {
      const before = assets.length;
      if (typeof where.url === "string") {
        assets = assets.filter((asset) => asset.url !== where.url);
      } else if (where.url?.in) {
        const urls = new Set(where.url.in);
        assets = assets.filter((asset) => !urls.has(asset.url));
      } else if (where.url?.notIn) {
        const urls = new Set(where.url.notIn);
        assets = assets.filter((asset) => urls.has(asset.url));
      } else {
        assets = [];
      }
      return { count: before - assets.length };
    }
  });
  Object.defineProperty(prisma.asset, "createMany", {
    configurable: true,
    value: async ({ data }: { data: Array<Omit<TestAsset, "id" | "createdAt" | "updatedAt">> }) => {
      for (const item of data) {
        const date = new Date();
        assets.push({
          ...item,
          id: `asset-created-${nextAssetId++}`,
          createdAt: date,
          updatedAt: date
        });
      }
      return { count: data.length };
    }
  });
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (
      callback: (transaction: {
        landingPage: typeof prisma.landingPage;
        asset: typeof prisma.asset;
      }) => Promise<unknown>
    ) =>
      callback({
        landingPage: prisma.landingPage,
        asset: prisma.asset
      })
  });

  const token = await createAccessToken({
    id: "user-1",
    email: "admin@tessa.com.br",
    role: "ADMIN"
  });
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  return {
    adminContentRouter,
    publicContentRouter,
    headers,
    publishedImages,
    getPage: () => page,
    getAssets: () => assets
  };
}

describe("operation section published asset safety", () => {
  it("retains a replaced published asset until the replacement is published", async () => {
    const harness = await createOperationHarness();
    const replacement = {
      url: "https://cdn.example.com/replacement.webp",
      alt: "Imagem substituta",
      meta: {
        pathname: "landing-page/home/operation-section/replacement.webp",
        mimeType: "image/webp",
        sizeBytes: 120,
        originalFilename: "replacement.jpg"
      }
    };
    const nextImages = [replacement, ...harness.publishedImages.slice(1)];
    const blobCleanupErrors: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      blobCleanupErrors.push(args);
    };

    try {
      const updateResponse = await harness.adminContentRouter.request("/operation-section", {
        method: "PUT",
        headers: harness.headers,
        body: JSON.stringify({ images: nextImages })
      });
      assert.equal(updateResponse.status, 200);
      assert.equal(
        harness.getAssets().some((asset) => asset.url === harness.publishedImages[0]?.url),
        true
      );
      assert.equal(
        harness.getAssets().some((asset) => asset.url === replacement.url),
        true
      );
      assert.equal(blobCleanupErrors.length, 0);

      const publicBeforePublish = await harness.publicContentRouter.request("/");
      const beforePayload = (await publicBeforePublish.json()) as {
        content: { operationSection: { images: TestImage[] } };
      };
      assert.equal(
        beforePayload.content.operationSection.images[0]?.url,
        harness.publishedImages[0]?.url
      );

      const publishResponse = await harness.adminContentRouter.request("/publish", {
        method: "POST",
        headers: harness.headers
      });
      assert.equal(publishResponse.status, 200);
      assert.equal(
        harness.getAssets().some((asset) => asset.url === harness.publishedImages[0]?.url),
        false
      );
      assert.equal(
        harness.getAssets().some((asset) => asset.url === replacement.url),
        true
      );
      assert.equal(blobCleanupErrors.length, 1);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("retains a deleted published asset while reordering the remaining draft images", async () => {
    const harness = await createOperationHarness();
    const removedUrl = harness.publishedImages[1]!.url;
    const deleteResponse = await harness.adminContentRouter.request(
      "/operation-section/images/1",
      {
        method: "DELETE",
        headers: harness.headers
      }
    );
    assert.equal(deleteResponse.status, 200);
    assert.equal(harness.getAssets().some((asset) => asset.url === removedUrl), true);

    const draftImages = (
      harness.getPage().draftContent.operationSection as { images: TestImage[] }
    ).images;
    const reorderedImages = [...draftImages].reverse();
    const reorderResponse = await harness.adminContentRouter.request("/operation-section", {
      method: "PUT",
      headers: harness.headers,
      body: JSON.stringify({ images: reorderedImages })
    });
    assert.equal(reorderResponse.status, 200);

    const activeAssets = harness
      .getAssets()
      .filter((asset) => reorderedImages.some((image) => image.url === asset.url))
      .sort((left, right) => (left.slot ?? 0) - (right.slot ?? 0));
    assert.deepEqual(
      activeAssets.map((asset) => asset.url),
      reorderedImages.map((image) => image.url)
    );
    assert.equal(harness.getAssets().some((asset) => asset.url === removedUrl), true);
  });
});

describe("operation section caption updates", () => {
  it("clears a previously saved optional caption when the next save omits it", async () => {
    const harness = await createOperationHarness();
    const withCaption = harness.publishedImages.map((image, index) =>
      index === 0 ? { ...image, caption: "Legenda da operação" } : image
    );

    const saveWithCaption = await harness.adminContentRouter.request("/operation-section", {
      method: "PUT",
      headers: harness.headers,
      body: JSON.stringify({ images: withCaption })
    });
    assert.equal(saveWithCaption.status, 200);

    const savedWithCaption = (await saveWithCaption.json()) as {
      operationSection: { images: Array<{ caption?: string }> };
    };
    assert.equal(savedWithCaption.operationSection.images[0]?.caption, "Legenda da operação");

    const withoutCaption = withCaption.map((image, index) =>
      index === 0 ? { url: image.url, alt: image.alt } : image
    );
    const saveWithoutCaption = await harness.adminContentRouter.request("/operation-section", {
      method: "PUT",
      headers: harness.headers,
      body: JSON.stringify({ images: withoutCaption })
    });
    assert.equal(saveWithoutCaption.status, 200);

    const savedWithoutCaption = (await saveWithoutCaption.json()) as {
      operationSection: { images: Array<{ caption?: string }> };
    };
    assert.equal(savedWithoutCaption.operationSection.images[0]?.caption, undefined);
    assert.equal(
      Object.hasOwn(savedWithoutCaption.operationSection.images[0] ?? {}, "caption"),
      false
    );
  });
});
