import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
}

export function rateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyGenerator } = options;
  const store = new Map<string, RateLimitEntry>();

  function getKey(c: Context): string {
    if (keyGenerator) return keyGenerator(c);
    return c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  }

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }

  return async (c, next) => {
    if (store.size > 10_000) cleanup();

    const key = getKey(c);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", String(max - 1));
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      c.header("X-RateLimit-Limit", String(max));
      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HTTPException(429, { message: "Muitas requisições. Tente novamente mais tarde." });
    }

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(max - entry.count));
    return next();
  };
}
