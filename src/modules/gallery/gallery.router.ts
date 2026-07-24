import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { badRequest, payloadTooLarge } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { normalizeLocale } from "../translation/translation.service.js";
import type { AppBindings } from "../../types.js";
import {
  createGalleryPhoto,
  createGalleryVideo,
  deleteGalleryMediaItem,
  getAdminGalleryMediaItem,
  listAdminGalleryMediaItems,
  listPublicGalleryMediaItems,
  reorderGalleryMediaItems,
  replaceGalleryPhoto,
  updateGalleryMediaItem
} from "./gallery.service.js";
import {
  createGalleryPhotoFieldsSchema,
  createGalleryVideoSchema,
  galleryIdParamsSchema,
  galleryListQuerySchema,
  MAX_GALLERY_PHOTO_BYTES,
  reorderGalleryMediaSchema,
  updateGalleryMediaItemSchema
} from "./gallery.schemas.js";
import {
  serializeGalleryMediaItemAdminResponse,
  serializeGalleryMediaItemsAdminListResponse,
  serializeGalleryMediaItemsPublicListResponse
} from "./gallery.serializers.js";

export const galleryRouter = new Hono<AppBindings>();

const adminRole = ["MASTER", "ADMIN"] as const;

function parseOptionalFormOrder(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    badRequest("Campo 'order' inválido.");
  }

  return parsed;
}

galleryRouter.get("/", zValidator("query", galleryListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const locale = normalizeLocale(c.req.query("locale"));
  const items = await listPublicGalleryMediaItems({
    kind: query.kind,
    categorySlug: query.categorySlug,
    locale
  });
  return c.json(serializeGalleryMediaItemsPublicListResponse(items));
});

galleryRouter.get("/admin", requireAuth, requireRole([...adminRole]), async (c) => {
  const query = galleryListQuerySchema.parse({
    kind: c.req.query("kind"),
    categorySlug: c.req.query("categorySlug")
  });
  const items = await listAdminGalleryMediaItems({
    kind: query.kind,
    categorySlug: query.categorySlug
  });
  return c.json(serializeGalleryMediaItemsAdminListResponse(items));
});

galleryRouter.get(
  "/admin/:id",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("param", galleryIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const item = await getAdminGalleryMediaItem(id);
    return c.json(serializeGalleryMediaItemAdminResponse(item));
  }
);

galleryRouter.post(
  "/videos",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("json", createGalleryVideoSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const item = await createGalleryVideo(body, user.id);
    return c.json(serializeGalleryMediaItemAdminResponse(item), 201);
  }
);

galleryRouter.post("/photos", requireAuth, requireRole([...adminRole]), async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    badRequest("Envie a foto como multipart/form-data.");
  }

  const contentLengthHeader = c.req.header("content-length");
  const contentLength =
    contentLengthHeader !== undefined ? Number(contentLengthHeader) : null;
  if (
    contentLength !== null &&
    Number.isFinite(contentLength) &&
    contentLength > MAX_GALLERY_PHOTO_BYTES + 512 * 1024
  ) {
    payloadTooLarge(
      `Arquivo maior do que o permitido. Limite atual: ${MAX_GALLERY_PHOTO_BYTES} bytes.`
    );
  }

  const formData = await c.req.formData();
  const rawFile = formData.get("file");
  if (!(rawFile instanceof File)) {
    badRequest("Campo 'file' é obrigatório.");
  }

  if (rawFile.size > MAX_GALLERY_PHOTO_BYTES) {
    payloadTooLarge(
      `Arquivo maior do que o permitido. Limite atual: ${MAX_GALLERY_PHOTO_BYTES} bytes.`
    );
  }

  const fields = createGalleryPhotoFieldsSchema.parse({
    alt: formData.get("alt"),
    caption: formData.get("caption") ?? undefined,
    categorySlug: formData.get("categorySlug") ?? undefined,
    order: parseOptionalFormOrder(formData.get("order"))
  });

  const user = c.get("user");
  const item = await createGalleryPhoto({
    file: rawFile,
    alt: fields.alt,
    caption: fields.caption,
    categorySlug: fields.categorySlug,
    order: fields.order,
    userId: user.id
  });

  return c.json(serializeGalleryMediaItemAdminResponse(item), 201);
});

galleryRouter.put(
  "/reorder",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("json", reorderGalleryMediaSchema),
  async (c) => {
    const body = c.req.valid("json");
    const items = await reorderGalleryMediaItems(body);
    return c.json(serializeGalleryMediaItemsAdminListResponse(items));
  }
);

galleryRouter.put(
  "/:id",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("param", galleryIdParamsSchema),
  zValidator("json", updateGalleryMediaItemSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const item = await updateGalleryMediaItem(id, body);
    return c.json(serializeGalleryMediaItemAdminResponse(item));
  }
);

galleryRouter.put(
  "/:id/image",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("param", galleryIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      badRequest("Envie a foto como multipart/form-data.");
    }

    const formData = await c.req.formData();
    const rawFile = formData.get("file");
    if (!(rawFile instanceof File)) {
      badRequest("Campo 'file' é obrigatório.");
    }

    if (rawFile.size > MAX_GALLERY_PHOTO_BYTES) {
      payloadTooLarge(
        `Arquivo maior do que o permitido. Limite atual: ${MAX_GALLERY_PHOTO_BYTES} bytes.`
      );
    }

    const user = c.get("user");
    const item = await replaceGalleryPhoto(id, rawFile, user.id);
    return c.json(serializeGalleryMediaItemAdminResponse(item));
  }
);

galleryRouter.delete(
  "/:id",
  requireAuth,
  requireRole([...adminRole]),
  zValidator("param", galleryIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteGalleryMediaItem(id);
    return c.json({ message: "Item da Galeria removido com sucesso." });
  }
);
