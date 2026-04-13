import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { badRequest } from "../../lib/http.js";
import type { AppBindings } from "../../types.js";
import {
  heroSectionImageUploadFormSchema,
  heroSectionImageUploadParamsSchema
} from "../assets/assets.schemas.js";
import { normalizeOptionalText } from "../assets/assets.utils.js";
import { collectionConfigs, servicesPagesConfig, singularSectionConfigs } from "./content.config.js";
import {
  serializeAdminContentResponse,
  serializeCollectionItemResponse,
  serializeCollectionResponse,
  serializeServicePageResponse,
  serializeServicePagesResponse,
  serializeSectionResponse
} from "./content.serializers.js";
import {
  createCollectionItem,
  createServicePage,
  createSingularSection,
  deleteCollectionItem,
  deleteServicePage,
  deleteSingularSection,
  getAdminContent,
  getCollectionItem,
  getServicePage,
  getSingularSection,
  listCollectionItems,
  listServicePages,
  publishMainContent,
  updateCollectionItem,
  updateServicePage,
  updateSingularSection,
  uploadHeroSectionTopicImage
} from "./content.service.js";
import { collectionItemParamsSchema, servicePageSlugParamsSchema } from "./content.schemas.js";

export const adminContentRouter = new Hono<AppBindings>();
const requireAdminWriteAccess = [requireAuth, requireRole(["MASTER", "ADMIN"])] as const;

adminContentRouter.get("/", async (c) => {
  const content = await getAdminContent();
  return c.json(serializeAdminContentResponse(content));
});

adminContentRouter.post("/publish", ...requireAdminWriteAccess, async (c) => {
  const user = c.get("user");
  const content = await publishMainContent(user.id);

  return c.json(serializeAdminContentResponse(content));
});

adminContentRouter.post(
  "/hero-section/:topicIndex/image",
  ...requireAdminWriteAccess,
  zValidator("param", heroSectionImageUploadParamsSchema),
  async (c) => {
    const { topicIndex } = c.req.valid("param");
    const formData = await c.req.formData();
    const file = formData.get("file");
    const rawAlt = formData.get("alt");

    if (!(file instanceof File)) {
      badRequest("Arquivo 'file' é obrigatório.");
    }

    if (rawAlt !== null && typeof rawAlt !== "string") {
      badRequest("Campo 'alt' inválido.");
    }

    const parsedForm = heroSectionImageUploadFormSchema.safeParse({
      alt: normalizeOptionalText(rawAlt)
    });

    if (!parsedForm.success) {
      badRequest("Campo 'alt' inválido.");
    }

    const user = c.get("user");
    const result = await uploadHeroSectionTopicImage(
      topicIndex,
      file,
      parsedForm.data.alt,
      user.id
    );

    return c.json(result, 201);
  }
);

for (const section of singularSectionConfigs) {
  const path = `/${section.path}`;

  adminContentRouter.get(path, async (c) => {
    const value = await getSingularSection(section);
    return c.json(serializeSectionResponse(section.key, value));
  });

  adminContentRouter.post(
    path,
    ...requireAdminWriteAccess,
    zValidator("json", section.schema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user");
      const value = await createSingularSection(section, input, user.id);

      return c.json(serializeSectionResponse(section.key, value), 201);
    }
  );

  adminContentRouter.put(
    path,
    ...requireAdminWriteAccess,
    zValidator("json", section.schema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user");
      const value = await updateSingularSection(section, input, user.id);

      return c.json(serializeSectionResponse(section.key, value));
    }
  );

  adminContentRouter.delete(path, ...requireAdminWriteAccess, async (c) => {
    const user = c.get("user");
    await deleteSingularSection(section, user.id);

    return c.body(null, 204);
  });
}

adminContentRouter.get(`/${servicesPagesConfig.path}`, async (c) => {
  const servicesPages = await listServicePages();
  return c.json(serializeServicePagesResponse(servicesPages));
});

adminContentRouter.post(
  `/${servicesPagesConfig.path}`,
  ...requireAdminWriteAccess,
  zValidator("json", servicesPagesConfig.schema),
  async (c) => {
    const input = c.req.valid("json");
    const user = c.get("user");
    const item = await createServicePage(input, user.id);

    return c.json(serializeServicePageResponse(item), 201);
  }
);

adminContentRouter.get(
  `/${servicesPagesConfig.path}/:slug`,
  zValidator("param", servicePageSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const item = await getServicePage(slug);

    return c.json(serializeServicePageResponse(item));
  }
);

adminContentRouter.put(
  `/${servicesPagesConfig.path}/:slug`,
  ...requireAdminWriteAccess,
  zValidator("param", servicePageSlugParamsSchema),
  zValidator("json", servicesPagesConfig.schema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = c.get("user");
    const item = await updateServicePage(slug, input, user.id);

    return c.json(serializeServicePageResponse(item));
  }
);

adminContentRouter.delete(
  `/${servicesPagesConfig.path}/:slug`,
  ...requireAdminWriteAccess,
  zValidator("param", servicePageSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const user = c.get("user");
    await deleteServicePage(slug, user.id);

    return c.body(null, 204);
  }
);

for (const collection of collectionConfigs) {
  const basePath = `/${collection.path}`;
  const itemPath = `${basePath}/:itemId`;

  adminContentRouter.get(basePath, async (c) => {
    const items = await listCollectionItems(collection);
    return c.json(serializeCollectionResponse(collection.key, items));
  });

  adminContentRouter.post(
    basePath,
    ...requireAdminWriteAccess,
    zValidator("json", collection.schema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user");
      const item = await createCollectionItem(
        collection,
        input as Record<string, unknown>,
        user.id
      );

      return c.json(serializeCollectionItemResponse(item), 201);
    }
  );

  adminContentRouter.get(itemPath, zValidator("param", collectionItemParamsSchema), async (c) => {
    const { itemId } = c.req.valid("param");
    const item = await getCollectionItem(collection, itemId);

    return c.json(serializeCollectionItemResponse(item));
  });

  adminContentRouter.put(
    itemPath,
    ...requireAdminWriteAccess,
    zValidator("param", collectionItemParamsSchema),
    zValidator("json", collection.schema),
    async (c) => {
      const { itemId } = c.req.valid("param");
      const input = c.req.valid("json");
      const user = c.get("user");
      const item = await updateCollectionItem(
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
    ...requireAdminWriteAccess,
    zValidator("param", collectionItemParamsSchema),
    async (c) => {
      const { itemId } = c.req.valid("param");
      const user = c.get("user");
      await deleteCollectionItem(collection, itemId, user.id);

      return c.body(null, 204);
    }
  );
}
