import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { badRequest } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { rateLimiter } from "../../middlewares/rate-limit.js";
import type { AppBindings } from "../../types.js";
import {
  createTestimonialSchema,
  testimonialIdParamsSchema,
  testimonialListQuerySchema,
  updateTestimonialModerationSchema
} from "./testimonial.schemas.js";
import {
  serializeAdminTestimonialListResponse,
  serializeAdminTestimonialResponse,
  serializePublicTestimonialListResponse,
  serializeTestimonialStatsResponse
} from "./testimonial.serializers.js";
import {
  createTestimonial,
  deleteTestimonial,
  getTestimonialById,
  getTestimonialStats,
  listApprovedTestimonials,
  listTestimonials,
  updateTestimonialModeration
} from "./testimonial.service.js";

export const testimonialRouter = new Hono<AppBindings>();

const submitRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10
});

function normalizeOptionalFormString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

testimonialRouter.get("/", async (c) => {
  const testimonials = await listApprovedTestimonials();

  return c.json(serializePublicTestimonialListResponse(testimonials));
});

testimonialRouter.post("/", submitRateLimit, async (c) => {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await c.req.formData();

    const parsed = createTestimonialSchema.safeParse({
      authorName: formData.get("authorName"),
      authorRole: normalizeOptionalFormString(formData.get("authorRole")),
      companyName: normalizeOptionalFormString(formData.get("companyName")),
      rating: formData.get("rating"),
      comment: formData.get("comment"),
      question: normalizeOptionalFormString(formData.get("question"))
    });

    if (!parsed.success) {
      badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

    const profileImageEntry = formData.get("profileImage");
    const reviewImageEntry = formData.get("reviewImage");

    const profileImage = profileImageEntry instanceof File ? profileImageEntry : null;
    const reviewImage = reviewImageEntry instanceof File ? reviewImageEntry : null;

    const testimonial = await createTestimonial(parsed.data, {
      profileImage,
      reviewImage
    });

    return c.json(serializeAdminTestimonialResponse(testimonial), 201);
  }

  const json = await c.req.json().catch(() => {
    badRequest("Corpo da requisição inválido.");
  });

  const parsed = createTestimonialSchema.safeParse(json);
  if (!parsed.success) {
    badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const testimonial = await createTestimonial(parsed.data);

  return c.json(serializeAdminTestimonialResponse(testimonial), 201);
});

testimonialRouter.use("/admin", requireAuth, requireRole(["MASTER", "ADMIN"]));
testimonialRouter.use("/admin/*", requireAuth, requireRole(["MASTER", "ADMIN"]));

testimonialRouter.get(
  "/admin",
  zValidator("query", testimonialListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listTestimonials(query);

    return c.json(serializeAdminTestimonialListResponse(result));
  }
);

testimonialRouter.get("/admin/stats", async (c) => {
  const stats = await getTestimonialStats();

  return c.json(serializeTestimonialStatsResponse(stats));
});

testimonialRouter.get(
  "/admin/:id",
  zValidator("param", testimonialIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const testimonial = await getTestimonialById(id);

    return c.json(serializeAdminTestimonialResponse(testimonial));
  }
);

testimonialRouter.patch(
  "/admin/:id/moderation",
  zValidator("param", testimonialIdParamsSchema),
  zValidator("json", updateTestimonialModerationSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const user = c.get("user");
    const testimonial = await updateTestimonialModeration(id, input, user.id);

    return c.json(serializeAdminTestimonialResponse(testimonial));
  }
);

testimonialRouter.delete(
  "/admin/:id",
  zValidator("param", testimonialIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteTestimonial(id);

    return c.json({ message: "Depoimento removido." });
  }
);
