import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { structuredLogger } from "./middlewares/logger.js";
import { authRouter } from "./routes/auth.js";
import { blogRouter } from "./routes/blog.js";
import { contentRouter } from "./routes/content.js";
import { googleReviewsInternalRouter } from "./routes/google-reviews.js";
import { healthRouter } from "./routes/health.js";
import { contactRouter } from "./routes/contact.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { documentsRouter } from "./routes/documents.js";
import { galleryRouter } from "./routes/gallery.js";
import { npsRouter } from "./routes/nps.js";
import { testimonialRouter } from "./routes/testimonial.js";
import { instagramInternalRouter, instagramRouter } from "./routes/instagram.js";
import { translationRouter } from "./routes/translations.js";
import { usersRouter } from "./routes/users.js";

const app = new Hono();

app.use("*", structuredLogger());

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);

app.get("/", (c) =>
  c.json({
    name: "tessa-api",
    status: "running"
  })
);

app.route("/api/health", healthRouter);
app.route("/api/auth", authRouter);
app.route("/api/users", usersRouter);
app.route("/api/blog", blogRouter);
app.route("/api/contacts", contactRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/nps", npsRouter);
app.route("/api/testimonials", testimonialRouter);
app.route("/api/content", contentRouter);
app.route("/api/documents", documentsRouter);
app.route("/api/gallery", galleryRouter);
app.route("/api/instagram", instagramRouter);
app.route("/api/internal/translations", translationRouter);
app.route("/api/internal/instagram", instagramInternalRouter);
app.route("/api/internal/google-reviews", googleReviewsInternalRouter);

app.notFound((c) =>
  c.json(
    {
      error: "Rota não encontrada."
    },
    404
  )
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      {
        error: error.message
      },
      error.status
    );
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const message = issue
      ? `Dados inválidos: ${issue.path.join(".")} — ${issue.message}`
      : "Dados inválidos.";

    return c.json({ error: message }, 400);
  }

  console.error(error);

  return c.json(
    {
      error: "Erro interno do servidor."
    },
    500
  );
});

export { app };
export default app;
