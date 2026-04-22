import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { badRequest } from "../../lib/http.js";
import { requireAuth } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import {
  serializeBlogArticleResponse,
  serializeBlogArticlesListResponse,
  serializeBlogBodyImageUploadResponse
} from "./blog.serializers.js";
import {
  blogArticleSlugParamsSchema,
  blogListQuerySchema,
  createBlogArticleSchema,
  updateBlogArticleSchema
} from "./blog.schemas.js";
import {
  createBlogArticle,
  deleteBlogArticle,
  getBlogArticleBySlug,
  getPublishedBlogArticleBySlug,
  listAdminBlogArticles,
  listBlogArticles,
  updateBlogArticle,
  uploadBlogBodyImage
} from "./blog.service.js";

export const blogRouter = new Hono<AppBindings>();

blogRouter.get(
  "/",
  zValidator("query", blogListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listBlogArticles({ ...query, status: "published" });
    return c.json(serializeBlogArticlesListResponse(result));
  }
);

blogRouter.get(
  "/admin",
  requireAuth,
  zValidator("query", blogListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listAdminBlogArticles(query);
    return c.json(serializeBlogArticlesListResponse(result));
  }
);

blogRouter.get(
  "/admin/:slug",
  requireAuth,
  zValidator("param", blogArticleSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const article = await getBlogArticleBySlug(slug);
    return c.json(serializeBlogArticleResponse(article));
  }
);

blogRouter.post(
  "/body-images",
  requireAuth,
  async (c) => {
    const formData = await c.req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      badRequest("Arquivo de imagem é obrigatório.");
    }

    const user = c.get("user");
    const { url } = await uploadBlogBodyImage(image as File, user.id);
    return c.json(serializeBlogBodyImageUploadResponse(url), 201);
  }
);

blogRouter.get(
  "/:slug",
  zValidator("param", blogArticleSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const article = await getPublishedBlogArticleBySlug(slug);
    return c.json(serializeBlogArticleResponse(article));
  }
);

blogRouter.post(
  "/",
  requireAuth,
  async (c) => {
    const formData = await c.req.formData();

    const statusRaw = formData.get("status");
    const body = createBlogArticleSchema.parse({
      title: formData.get("title"),
      content: formData.get("content") ?? "",
      categorySlug: formData.get("categorySlug"),
      headerImageAlt: formData.get("headerImageAlt") || undefined,
      status: typeof statusRaw === "string" ? statusRaw : undefined
    });

    const headerImage = formData.get("headerImage");
    const file = headerImage instanceof File ? headerImage : null;

    const user = c.get("user");
    const article = await createBlogArticle(body, user.id, file);

    return c.json(serializeBlogArticleResponse(article), 201);
  }
);

blogRouter.put(
  "/:slug",
  requireAuth,
  zValidator("param", blogArticleSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    const formData = await c.req.formData();

    const statusRaw = formData.get("status");
    const contentRaw = formData.get("content");
    const body = updateBlogArticleSchema.parse({
      title: formData.get("title") || undefined,
      content: typeof contentRaw === "string" ? contentRaw : undefined,
      categorySlug: formData.get("categorySlug") || undefined,
      headerImageAlt: formData.get("headerImageAlt") || undefined,
      removeHeaderImage: formData.get("removeHeaderImage") === "true" || undefined,
      status: typeof statusRaw === "string" ? statusRaw : undefined
    });

    const headerImage = formData.get("headerImage");
    const file = headerImage instanceof File ? headerImage : null;

    const user = c.get("user");
    const article = await updateBlogArticle(slug, body, user.id, file);

    return c.json(serializeBlogArticleResponse(article));
  }
);

blogRouter.delete(
  "/:slug",
  requireAuth,
  zValidator("param", blogArticleSlugParamsSchema),
  async (c) => {
    const { slug } = c.req.valid("param");
    await deleteBlogArticle(slug);
    return c.json({ message: "Artigo removido com sucesso." });
  }
);
