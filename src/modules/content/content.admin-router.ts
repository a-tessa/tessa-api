import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { badRequest } from "../../lib/http.js";
import type { AppBindings } from "../../types.js";
import { heroSectionImageAltSchema } from "../assets/assets.schemas.js";
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
  createHeroSection,
  createCollectionItem,
  createServicePage,
  createSingularSection,
  deleteHeroSection,
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
  updateHeroSection,
  updateCollectionItem,
  updateServicePage,
  updateSingularSection
} from "./content.service.js";
import {
  collectionItemParamsSchema,
  heroSectionInputSchema,
  heroSectionSchema,
  servicePageSlugParamsSchema
} from "./content.schemas.js";
import type { DraftContent, HeroSectionInput } from "./content.types.js";

export const adminContentRouter = new Hono<AppBindings>();
const requireAdminWriteAccess = [requireAuth, requireRole(["MASTER", "ADMIN"])] as const;
const heroSectionConfig = singularSectionConfigs.find((section) => section.key === "heroSection")!;
const nonHeroSections = singularSectionConfigs.filter((section) => section.key !== "heroSection");

function isMultipartRequest(contentType: string | undefined) {
  return contentType?.toLowerCase().includes("multipart/form-data") ?? false;
}

async function parseHeroSectionBody(c: Context<AppBindings>): Promise<{
  input: HeroSectionInput;
  uploadsByIndex: Map<number, File>;
  altsByIndex: Map<number, string>;
}> {
  const contentType = c.req.header("content-type");

  if (!isMultipartRequest(contentType)) {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      badRequest("Body JSON inválido.");
    }

    const parsedBody = heroSectionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      badRequest("Payload da seção hero inválido.");
    }

    return {
      input: parsedBody.data,
      uploadsByIndex: new Map(),
      altsByIndex: new Map()
    };
  }

  const formData = await c.req.formData();
  const payload = formData.get("payload");

  if (typeof payload !== "string" || payload.trim().length === 0) {
    badRequest("Campo 'payload' é obrigatório.");
  }

  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(payload);
  } catch {
    badRequest("Campo 'payload' precisa conter um JSON válido.");
  }

  const parsedPayload = heroSectionInputSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    badRequest("Payload da seção hero inválido.");
  }

  const uploadsByIndex = new Map<number, File>();
  const altsByIndex = new Map<number, string>();
  const topicCount = parsedPayload.data.length;

  for (let index = 0; index < 3; index += 1) {
    const rawFile = formData.get(`image_${index}`);
    const rawAlt = formData.get(`alt_${index}`);
    const hasSlot = index < topicCount;

    if (rawFile !== null) {
      if (!(rawFile instanceof File)) {
        badRequest(`Campo 'image_${index}' inválido.`);
      }

      if (!hasSlot && (rawFile.size > 0 || rawFile.name)) {
        badRequest(`Campo 'image_${index}' não corresponde a nenhum tópico do Hero.`);
      }

      if (rawFile.size > 0 || rawFile.name) {
        uploadsByIndex.set(index, rawFile);
      }
    }

    if (rawAlt !== null && typeof rawAlt !== "string") {
      badRequest(`Campo 'alt_${index}' inválido.`);
    }

    const normalizedAlt = normalizeOptionalText(rawAlt);

    if (normalizedAlt) {
      if (!hasSlot) {
        badRequest(`Campo 'alt_${index}' não corresponde a nenhum tópico do Hero.`);
      }

      const parsedAlt = heroSectionImageAltSchema.safeParse(normalizedAlt);

      if (!parsedAlt.success) {
        badRequest(`Campo 'alt_${index}' inválido.`);
      }

      altsByIndex.set(index, parsedAlt.data);
    }
  }

  return {
    input: parsedPayload.data,
    uploadsByIndex,
    altsByIndex
  };
}

adminContentRouter.get("/", async (c) => {
  const content = await getAdminContent();
  return c.json(serializeAdminContentResponse(content));
});

adminContentRouter.post("/publish", ...requireAdminWriteAccess, async (c) => {
  const user = c.get("user");
  const content = await publishMainContent(user.id);

  return c.json(serializeAdminContentResponse(content));
});

adminContentRouter.get("/hero-section", async (c) => {
  const value = await getSingularSection(heroSectionConfig);
  return c.json(serializeSectionResponse(heroSectionConfig.key, value));
});

adminContentRouter.post("/hero-section", ...requireAdminWriteAccess, async (c) => {
  const { input, uploadsByIndex, altsByIndex } = await parseHeroSectionBody(c);
  const user = c.get("user");
  const value = await createHeroSection(input, uploadsByIndex, altsByIndex, user.id);

  return c.json(serializeSectionResponse("heroSection", value), 201);
});

adminContentRouter.put("/hero-section", ...requireAdminWriteAccess, async (c) => {
  const { input, uploadsByIndex, altsByIndex } = await parseHeroSectionBody(c);
  const user = c.get("user");
  const value = await updateHeroSection(input, uploadsByIndex, altsByIndex, user.id);

  return c.json(serializeSectionResponse("heroSection", value));
});

adminContentRouter.delete("/hero-section", ...requireAdminWriteAccess, async (c) => {
  const user = c.get("user");
  await deleteHeroSection(user.id);

  return c.body(null, 204);
});

for (const section of nonHeroSections) {
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

      return c.json(
        serializeSectionResponse(
          section.key,
          value as NonNullable<DraftContent[typeof section.key]>
        ),
        201
      );
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

      return c.json(
        serializeSectionResponse(
          section.key,
          value as NonNullable<DraftContent[typeof section.key]>
        )
      );
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
