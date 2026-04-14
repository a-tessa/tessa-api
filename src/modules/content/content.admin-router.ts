import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { env } from "../../env.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { badRequest, payloadTooLarge } from "../../lib/http.js";
import type { AppBindings } from "../../types.js";
import { heroSectionImageAltSchema } from "../assets/assets.schemas.js";
import { normalizeOptionalText } from "../assets/assets.utils.js";
import { collectionConfigs, servicesPagesConfig, singularSectionConfigs } from "./content.config.js";
import {
  serializeAdminContentResponse,
  serializeCollectionItemResponse,
  serializeCollectionResponse,
  serializeScenerySectionResponse,
  serializeServicePageResponse,
  serializeServicePagesResponse,
  serializeSectionResponse
} from "./content.serializers.js";
import {
  createHeroSection,
  createOperationSection,
  createCollectionItem,
  createServicePage,
  createSingularSection,
  deleteHeroSection,
  deleteHeroSectionSlide,
  deleteOperationSection,
  deleteOperationSectionImage,
  deleteCollectionItem,
  deleteServicePage,
  deleteSingularSection,
  getAdminContent,
  getCollectionItem,
  getScenerySection,
  getServicePage,
  getSingularSection,
  listCollectionItems,
  listServicePages,
  publishMainContent,
  updateHeroSection,
  updateOperationSection,
  updateCollectionItem,
  updateServicePage,
  updateSingularSection
} from "./content.service.js";
import {
  collectionItemParamsSchema,
  heroSectionInputSchema,
  heroSectionSchema,
  heroSectionSlideParamsSchema,
  MAX_OPERATION_SECTION_IMAGES,
  operationSectionImageParamsSchema,
  operationSectionMultipartInputSchema,
  operationSectionSchema,
  servicePageSlugParamsSchema,
  servicesPageMultipartInputSchema,
  servicesPageMutationSchema
} from "./content.schemas.js";
import type {
  DraftContent,
  HeroSectionInput,
  OperationSection,
  OperationSectionMultipartInput,
  ServicePageMultipartInput,
  ServicesPageItem
} from "./content.types.js";

export const adminContentRouter = new Hono<AppBindings>();
const requireAdminWriteAccess = [requireAuth, requireRole(["MASTER", "ADMIN"])] as const;
const heroSectionConfig = singularSectionConfigs.find((section) => section.key === "heroSection")!;
const operationSectionConfig = singularSectionConfigs.find(
  (section) => section.key === "operationSection"
)!;
const jsonOnlySections = singularSectionConfigs.filter(
  (section) => section.key !== "heroSection" && section.key !== "operationSection"
);
const MAX_MULTIPART_BODY_BYTES = 4 * 1024 * 1024;
const MAX_OPERATION_SECTION_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_OPERATION_SECTION_MULTIPART_BODY_BYTES =
  MAX_OPERATION_SECTION_IMAGE_BYTES * MAX_OPERATION_SECTION_IMAGES + 1024 * 1024;
const MAX_SERVICE_PAGE_IMAGES = 15;
const MAX_SERVICE_PAGE_MULTIPART_BODY_BYTES =
  env.ASSET_MAX_UPLOAD_BYTES * (MAX_SERVICE_PAGE_IMAGES + 1) + 1024 * 1024;

adminContentRouter.use("*", requireAuth, requireRole(["MASTER", "ADMIN"]));

function isMultipartRequest(contentType: string | undefined) {
  return contentType?.toLowerCase().includes("multipart/form-data") ?? false;
}

function parseContentLength(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

  const contentLength = parseContentLength(c.req.header("content-length"));
  if (contentLength !== null && contentLength > MAX_MULTIPART_BODY_BYTES) {
    payloadTooLarge(
      `Multipart maior do que o suportado por este endpoint (${MAX_MULTIPART_BODY_BYTES} bytes). ` +
        "Reduza o tamanho total do request ou envie menos imagens por chamada."
    );
  }

  console.log(
    JSON.stringify({
      event: "hero-section.multipart.received",
      path: c.req.path,
      contentType,
      contentLength
    })
  );

  let formData: FormData;

  try {
    formData = await c.req.formData();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "hero-section.multipart.parse-failed",
        path: c.req.path,
        contentType,
        contentLength,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    badRequest("Não foi possível processar o multipart/form-data enviado.");
  }

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

function buildOperationSectionOversizeMessage(index: number, file: File) {
  const fileLabel = file.name ? `arquivo '${file.name}'` : "arquivo enviado";
  return (
    `Campo 'image_${index}' inválido: ${fileLabel} excede o limite de 3 MB ` +
    `(recebido: ${file.size} bytes).`
  );
}

function assertOperationSectionFileSizes(uploadsByIndex: Map<number, File>) {
  const oversizedUploads = [...uploadsByIndex.entries()]
    .filter(([, file]) => file.size > MAX_OPERATION_SECTION_IMAGE_BYTES)
    .map(([index, file]) => buildOperationSectionOversizeMessage(index, file));

  if (oversizedUploads.length === 1) {
    payloadTooLarge(oversizedUploads[0]!);
  }

  if (oversizedUploads.length > 1) {
    payloadTooLarge(
      `Algumas imagens excedem o limite de 3 MB: ${oversizedUploads.join(" ")}`
    );
  }
}

async function parseOperationSectionBody(c: Context<AppBindings>): Promise<{
  input: OperationSection | OperationSectionMultipartInput;
  uploadsByIndex: Map<number, File>;
}> {
  const contentType = c.req.header("content-type");

  if (!isMultipartRequest(contentType)) {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      badRequest("Body JSON inválido.");
    }

    const parsedBody = operationSectionSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      badRequest("Payload da seção de operação inválido.");
    }

    return {
      input: parsedBody.data,
      uploadsByIndex: new Map()
    };
  }

  const contentLength = parseContentLength(c.req.header("content-length"));
  if (contentLength !== null && contentLength > MAX_OPERATION_SECTION_MULTIPART_BODY_BYTES) {
    payloadTooLarge(
      `Multipart maior do que o suportado por este endpoint (${MAX_OPERATION_SECTION_MULTIPART_BODY_BYTES} bytes). ` +
        "Reduza o tamanho total do request ou envie menos imagens por chamada."
    );
  }

  let formData: FormData;

  try {
    formData = await c.req.formData();
  } catch {
    badRequest("Não foi possível processar o multipart/form-data enviado.");
  }

  for (const key of formData.keys()) {
    const match = /^image_(\d+)$/.exec(key);

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    if (index >= MAX_OPERATION_SECTION_IMAGES) {
      badRequest(
        `Campo '${key}' não é suportado. A seção de operação aceita no máximo ${MAX_OPERATION_SECTION_IMAGES} fotos.`
      );
    }
  }

  const payload = formData.get("payload");
  let rawPayload: unknown = {};

  if (payload !== null) {
    if (typeof payload !== "string") {
      badRequest("Campo 'payload' inválido.");
    }

    if (payload.trim().length > 0) {
      try {
        rawPayload = JSON.parse(payload);
      } catch {
        badRequest("Campo 'payload' precisa conter um JSON válido.");
      }
    }
  }

  const parsedPayload = operationSectionMultipartInputSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    badRequest("Payload da seção de operação inválido.");
  }

  const uploadsByIndex = new Map<number, File>();
  const payloadImageCount = parsedPayload.data.images?.length ?? 0;

  for (let index = 0; index < MAX_OPERATION_SECTION_IMAGES; index += 1) {
    const rawFile = formData.get(`image_${index}`);
    const hasSlot = index < payloadImageCount;

    if (rawFile === null) {
      continue;
    }

    if (!(rawFile instanceof File)) {
      badRequest(`Campo 'image_${index}' inválido.`);
    }

    if (rawFile.size === 0) {
      badRequest(
        `Campo 'image_${index}' não contém um arquivo válido. ` +
          "Verifique se o campo foi enviado como File no multipart/form-data."
      );
    }

    if (!rawFile.name) {
      badRequest(`Campo 'image_${index}' não contém um nome de arquivo válido.`);
    }

    if (!hasSlot && parsedPayload.data.images) {
      badRequest(`Campo 'image_${index}' não corresponde a nenhuma foto da seção de operação.`);
    }

    uploadsByIndex.set(index, rawFile);
  }

  if (uploadsByIndex.size === 0 && !parsedPayload.data.images?.length) {
    badRequest(
      "Nenhum arquivo de imagem foi recebido na seção de operação. " +
        "Envie os campos como File no multipart/form-data, por exemplo: image_0, image_1, image_2."
    );
  }

  assertOperationSectionFileSizes(uploadsByIndex);

  return {
    input: parsedPayload.data,
    uploadsByIndex
  };
}

async function parseServicePageBody(c: Context<AppBindings>): Promise<{
  input: ServicesPageItem | ServicePageMultipartInput;
  backgroundUpload: File | null;
  uploadsByIndex: Map<number, File>;
}> {
  const contentType = c.req.header("content-type");

  if (!isMultipartRequest(contentType)) {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      badRequest("Body JSON inválido.");
    }

    const parsedBody = servicesPageMutationSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      badRequest("Payload da página de serviço inválido.");
    }

    return {
      input: parsedBody.data,
      backgroundUpload: null,
      uploadsByIndex: new Map()
    };
  }

  const contentLength = parseContentLength(c.req.header("content-length"));
  if (contentLength !== null && contentLength > MAX_SERVICE_PAGE_MULTIPART_BODY_BYTES) {
    payloadTooLarge(
      `Multipart maior do que o suportado por este endpoint (${MAX_SERVICE_PAGE_MULTIPART_BODY_BYTES} bytes). ` +
        "Reduza o tamanho total do request ou envie menos imagens por chamada."
    );
  }

  let formData: FormData;

  try {
    formData = await c.req.formData();
  } catch {
    badRequest("Não foi possível processar o multipart/form-data enviado.");
  }

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

  const parsedPayload = servicesPageMultipartInputSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    badRequest("Payload da página de serviço inválido.");
  }

  const rawBackgroundImage = formData.get("backgroundImage");
  let backgroundUpload: File | null = null;

  if (rawBackgroundImage !== null) {
    if (!(rawBackgroundImage instanceof File)) {
      badRequest("Campo 'backgroundImage' inválido.");
    }

    if (rawBackgroundImage.size > 0 || rawBackgroundImage.name) {
      backgroundUpload = rawBackgroundImage;
    }
  }

  const uploadsByIndex = new Map<number, File>();
  const payloadImageCount = parsedPayload.data.images?.length ?? 0;

  for (let index = 0; index < MAX_SERVICE_PAGE_IMAGES; index += 1) {
    const rawFile = formData.get(`image_${index}`);
    const hasSlot = index < payloadImageCount;

    if (rawFile === null) {
      continue;
    }

    if (!(rawFile instanceof File)) {
      badRequest(`Campo 'image_${index}' inválido.`);
    }

    if (rawFile.size > 0 || rawFile.name) {
      if (!hasSlot && parsedPayload.data.images) {
        badRequest(`Campo 'image_${index}' não corresponde a nenhuma foto do serviço.`);
      }

      uploadsByIndex.set(index, rawFile);
    }
  }

  return {
    input: parsedPayload.data,
    backgroundUpload,
    uploadsByIndex
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
  return c.json(serializeSectionResponse("heroSection", value as NonNullable<DraftContent["heroSection"]>));
});

adminContentRouter.get("/scenery-section", async (c) => {
  const scenerySection = await getScenerySection();
  return c.json(serializeScenerySectionResponse(scenerySection));
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

adminContentRouter.delete(
  "/hero-section/slides/:slideIndex",
  ...requireAdminWriteAccess,
  zValidator("param", heroSectionSlideParamsSchema),
  async (c) => {
    const { slideIndex } = c.req.valid("param");
    const user = c.get("user");
    const value = await deleteHeroSectionSlide(slideIndex, user.id);

    if (!value) {
      return c.body(null, 204);
    }

    return c.json(serializeSectionResponse("heroSection", value));
  }
);

adminContentRouter.delete("/hero-section", ...requireAdminWriteAccess, async (c) => {
  const user = c.get("user");
  await deleteHeroSection(user.id);

  return c.body(null, 204);
});

adminContentRouter.get("/operation-section", async (c) => {
  const value = await getSingularSection(operationSectionConfig);
  return c.json(
    serializeSectionResponse(
      "operationSection",
      value as NonNullable<DraftContent["operationSection"]>
    )
  );
});

adminContentRouter.post("/operation-section", ...requireAdminWriteAccess, async (c) => {
  const { input, uploadsByIndex } = await parseOperationSectionBody(c);
  const user = c.get("user");
  const value = await createOperationSection(input, uploadsByIndex, user.id);

  return c.json(serializeSectionResponse("operationSection", value), 201);
});

adminContentRouter.put("/operation-section", ...requireAdminWriteAccess, async (c) => {
  const { input, uploadsByIndex } = await parseOperationSectionBody(c);
  const user = c.get("user");
  const value = await updateOperationSection(input, uploadsByIndex, user.id);

  return c.json(serializeSectionResponse("operationSection", value));
});

adminContentRouter.delete("/operation-section", ...requireAdminWriteAccess, async (c) => {
  const user = c.get("user");
  await deleteOperationSection(user.id);

  return c.body(null, 204);
});

adminContentRouter.delete(
  "/operation-section/images/:imageIndex",
  ...requireAdminWriteAccess,
  zValidator("param", operationSectionImageParamsSchema),
  async (c) => {
    const { imageIndex } = c.req.valid("param");
    const user = c.get("user");
    const value = await deleteOperationSectionImage(imageIndex, user.id);

    return c.json(serializeSectionResponse("operationSection", value));
  }
);

for (const section of jsonOnlySections) {
  const path = `/${section.path}`;

  adminContentRouter.get(path, async (c) => {
    const value = await getSingularSection(section);
    return c.json(
      serializeSectionResponse(
        section.key,
        value as NonNullable<DraftContent[typeof section.key]>
      )
    );
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
  async (c) => {
    const { input, backgroundUpload, uploadsByIndex } = await parseServicePageBody(c);
    const user = c.get("user");
    const item = await createServicePage(input, backgroundUpload, uploadsByIndex, user.id);

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
  async (c) => {
    const { slug } = c.req.valid("param");
    const { input, backgroundUpload, uploadsByIndex } = await parseServicePageBody(c);
    const user = c.get("user");
    const item = await updateServicePage(slug, input, backgroundUpload, uploadsByIndex, user.id);

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
