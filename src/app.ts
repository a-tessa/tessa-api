import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { structuredLogger } from "./middlewares/logger.js";
import { authRouter } from "./routes/auth.js";
import { contentRouter } from "./routes/content.js";
import { healthRouter } from "./routes/health.js";
import { usersRouter } from "./routes/users.js";

export const app = new Hono();

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
app.route("/api/content", contentRouter);

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

  console.error(error);

  return c.json(
    {
      error: "Erro interno do servidor."
    },
    500
  );
});
