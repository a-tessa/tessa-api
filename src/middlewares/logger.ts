import type { MiddlewareHandler } from "hono";

let counter = 0;

function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const seq = (counter++).toString(36);
  return `${timestamp}-${seq}`;
}

export function structuredLogger(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? generateRequestId();
    const start = performance.now();

    c.header("X-Request-Id", requestId);

    await next();

    const duration = Math.round(performance.now() - start);
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;

    const log = {
      requestId,
      method,
      path,
      status,
      duration: `${duration}ms`,
      ...(status >= 400 && { userAgent: c.req.header("user-agent") }),
    };

    if (status >= 500) {
      console.error(JSON.stringify(log));
    } else if (status >= 400) {
      console.warn(JSON.stringify(log));
    } else {
      console.log(JSON.stringify(log));
    }
  };
}
