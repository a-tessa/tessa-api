import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import { collectionConfigs, singularSectionConfigs } from "./content.config.js";
import {
  serializeAdminPageResponse,
  serializeAdminPagesResponse,
  serializeCollectionItemResponse,
  serializeCollectionResponse,
  serializeSectionResponse
} from "./content.serializers.js";
import {
  createCollectionItem,
  createSingularSection,
  deleteCollectionItem,
  deleteSingularSection,
  getAdminPage,
  getCollectionItem,
  getSingularSection,
  listAdminPages,
  listCollectionItems,
  publishPage,
  updateCollectionItem,
  updateSingularSection,
  upsertPage
} from "./content.service.js";
import {
  collectionItemParamsSchema,
  pageListQuerySchema,
  pageUpsertSchema,
  slugParamsSchema
} from "./content.schemas.js";

export const adminContentRouter = new Hono<AppBindings>();

adminContentRouter.use("*", requireAuth, requireRole(["MASTER", "ADMIN"]));

adminContentRouter.get("/pages", zValidator("query", pageListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const result = await listAdminPages(query);

  return c.json(serializeAdminPagesResponse(result));
});

adminContentRouter.get("/pages/:slug", zValidator("param", slugParamsSchema), async (c) => {
  const { slug } = c.req.valid("param");
  const page = await getAdminPage(slug);

  return c.json(serializeAdminPageResponse(page));
});

adminContentRouter.put(
  "/pages/:slug",
  zValidator("param", slugParamsSchema),
  zValidator("json", pageUpsertSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = c.get("user");
    const page = await upsertPage(slug, input, user.id);

    return c.json(serializeAdminPageResponse(page));
  }
);

adminContentRouter.post(
  "/pages/:slug/publish",
  zValidator("param", slugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const user = c.get("user");
    const page = await publishPage(slug, user.id);

    return c.json(serializeAdminPageResponse(page));
  }
);

for (const section of singularSectionConfigs) {
  const path = `/pages/:slug/${section.path}`;

  adminContentRouter.get(path, zValidator("param", slugParamsSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const value = await getSingularSection(slug, section);

    return c.json(serializeSectionResponse(section.key, value));
  });

  adminContentRouter.post(
    path,
    zValidator("param", slugParamsSchema),
    zValidator("json", section.schema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = c.get("user");
      const value = await createSingularSection(slug, section, input, user.id);

      return c.json(serializeSectionResponse(section.key, value), 201);
    }
  );

  adminContentRouter.put(
    path,
    zValidator("param", slugParamsSchema),
    zValidator("json", section.schema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = c.get("user");
      const value = await updateSingularSection(slug, section, input, user.id);

      return c.json(serializeSectionResponse(section.key, value));
    }
  );

  adminContentRouter.delete(path, zValidator("param", slugParamsSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const user = c.get("user");

    await deleteSingularSection(slug, section, user.id);

    return c.body(null, 204);
  });
}

for (const collection of collectionConfigs) {
  const basePath = `/pages/:slug/${collection.path}`;
  const itemPath = `${basePath}/:itemId`;

  adminContentRouter.get(basePath, zValidator("param", slugParamsSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const items = await listCollectionItems(slug, collection);

    return c.json(serializeCollectionResponse(collection.key, items));
  });

  adminContentRouter.post(
    basePath,
    zValidator("param", slugParamsSchema),
    zValidator("json", collection.schema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = c.get("user");
      const item = await createCollectionItem(
        slug,
        collection,
        input as Record<string, unknown>,
        user.id
      );

      return c.json(serializeCollectionItemResponse(item), 201);
    }
  );

  adminContentRouter.get(itemPath, zValidator("param", collectionItemParamsSchema), async (c) => {
    const { slug, itemId } = c.req.valid("param");
    const item = await getCollectionItem(slug, collection, itemId);

    return c.json(serializeCollectionItemResponse(item));
  });

  adminContentRouter.put(
    itemPath,
    zValidator("param", collectionItemParamsSchema),
    zValidator("json", collection.schema),
    async (c) => {
      const { slug, itemId } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = c.get("user");
      const item = await updateCollectionItem(
        slug,
        collection,
        itemId,
        input as Record<string, unknown>,
        user.id
      );

      return c.json(serializeCollectionItemResponse(item));
    }
  );

  adminContentRouter.delete(
    itemPath,
    zValidator("param", collectionItemParamsSchema),
    async (c) => {
      const { slug, itemId } = c.req.valid("param");
      const user = c.get("user");

      await deleteCollectionItem(slug, collection, itemId, user.id);

      return c.body(null, 204);
    }
  );
}
