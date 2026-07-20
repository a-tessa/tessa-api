import { zValidator } from "@hono/zod-validator";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Hono } from "hono";
import { env } from "../../env.js";
import { badRequest, unauthorized } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import { normalizeLocale } from "../translation/translation.service.js";
import {
  assertAuthenticatedUserFromToken,
  createDocument,
  deleteDocument,
  deleteDocumentCover,
  deleteDocumentFile,
  ensureBlobConfigured,
  getAdminDocument,
  listAdminDocuments,
  listPublicDocuments,
  persistDocumentFile,
  updateDocument,
  uploadDocumentCover
} from "./documents.service.js";
import {
  blobUploadClientPayloadSchema,
  createDocumentSchema,
  documentFileParamsSchema,
  documentIdParamsSchema,
  documentsListQuerySchema,
  persistDocumentFileSchema,
  updateDocumentSchema
} from "./documents.schemas.js";
import {
  serializeDocumentAdminResponse,
  serializeDocumentsAdminListResponse,
  serializeDocumentsPublicListResponse
} from "./documents.serializers.js";

export const documentsRouter = new Hono<AppBindings>();

documentsRouter.get(
  "/",
  zValidator("query", documentsListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const locale = normalizeLocale(c.req.query("locale"));
    const documents = await listPublicDocuments({
      locale,
      categorySlug: query.categorySlug
    });
    return c.json(serializeDocumentsPublicListResponse(documents));
  }
);

documentsRouter.get(
  "/admin",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  async (c) => {
    const documents = await listAdminDocuments();
    return c.json(serializeDocumentsAdminListResponse(documents));
  }
);

documentsRouter.get(
  "/admin/:id",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const document = await getAdminDocument(id);
    return c.json(serializeDocumentAdminResponse(document));
  }
);

documentsRouter.post(
  "/",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("json", createDocumentSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const document = await createDocument(body, user.id);
    return c.json(serializeDocumentAdminResponse(document), 201);
  }
);

documentsRouter.put(
  "/:id",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentIdParamsSchema),
  zValidator("json", updateDocumentSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const document = await updateDocument(id, body);
    return c.json(serializeDocumentAdminResponse(document));
  }
);

documentsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteDocument(id);
    return c.json({ message: "Documento removido com sucesso." });
  }
);

documentsRouter.post("/blob/upload-token", async (c) => {
  const token = ensureBlobConfigured();
  const body = (await c.req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: c.req.raw,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) {
          unauthorized("Payload de autenticação ausente.");
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(clientPayload);
        } catch {
          badRequest("Payload de autenticação inválido.");
        }

        const payload = blobUploadClientPayloadSchema.parse(parsed);
        await assertAuthenticatedUserFromToken(payload.token);

        const expectedPrefix = `documents/${payload.documentId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          badRequest("Pathname do upload inválido.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: env.DOCUMENT_MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            documentId: payload.documentId,
            locale: payload.locale
          })
        };
      },
      onUploadCompleted: async () => {
        // Persistence is handled by PUT /:id/files/:locale so local/dev works
        // without a public callback URL from Vercel Blob.
      }
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof Error && "getResponse" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Falha no upload.";
    badRequest(message);
  }
});

documentsRouter.put(
  "/:id/files/:locale",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentFileParamsSchema),
  zValidator("json", persistDocumentFileSchema),
  async (c) => {
    const { id, locale } = c.req.valid("param");
    const body = c.req.valid("json");
    const document = await persistDocumentFile(id, locale, body);
    return c.json(serializeDocumentAdminResponse(document));
  }
);

documentsRouter.delete(
  "/:id/files/:locale",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentFileParamsSchema),
  async (c) => {
    const { id, locale } = c.req.valid("param");
    const document = await deleteDocumentFile(id, locale);
    return c.json(serializeDocumentAdminResponse(document));
  }
);

documentsRouter.put(
  "/:id/files/:locale/cover",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentFileParamsSchema),
  async (c) => {
    const { id, locale } = c.req.valid("param");
    const formData = await c.req.formData();
    const coverImage = formData.get("coverImage");

    if (!(coverImage instanceof File)) {
      badRequest("Arquivo de imagem de capa é obrigatório.");
    }

    const document = await uploadDocumentCover(id, locale, coverImage);
    return c.json(serializeDocumentAdminResponse(document));
  }
);

documentsRouter.delete(
  "/:id/files/:locale/cover",
  requireAuth,
  requireRole(["MASTER", "ADMIN"]),
  zValidator("param", documentFileParamsSchema),
  async (c) => {
    const { id, locale } = c.req.valid("param");
    const document = await deleteDocumentCover(id, locale);
    return c.json(serializeDocumentAdminResponse(document));
  }
);
