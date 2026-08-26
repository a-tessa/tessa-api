import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notifySeoIndexChanged,
  requestSeoIndexRevalidation,
  resolveSeoIndexRevalidationTarget
} from "../seo-index-revalidation.js";

describe("resolveSeoIndexRevalidationTarget", () => {
  it("returns null when the landing URL or secret is missing", () => {
    assert.equal(
      resolveSeoIndexRevalidationTarget({
        landingAppUrl: "https://tessa.com.br",
        secret: undefined
      }),
      null
    );
    assert.equal(
      resolveSeoIndexRevalidationTarget({
        landingAppUrl: undefined,
        secret: "configured-secret-16"
      }),
      null
    );
  });

  it("strips a trailing slash from the landing URL", () => {
    assert.deepEqual(
      resolveSeoIndexRevalidationTarget({
        landingAppUrl: "https://tessa.com.br/",
        secret: "configured-secret-16"
      }),
      {
        landingAppUrl: "https://tessa.com.br",
        secret: "configured-secret-16"
      }
    );
  });
});

describe("requestSeoIndexRevalidation", () => {
  it("posts once to the landing revalidation route with the secret", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ revalidated: true }), { status: 200 });
    }) as typeof fetch;

    await requestSeoIndexRevalidation({
      landingAppUrl: "https://tessa.com.br",
      secret: "configured-secret-16",
      fetchImpl
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://tessa.com.br/api/revalidate-seo-index");
    assert.equal(calls[0]?.init.method, "POST");
    const headers = new Headers(calls[0]?.init.headers);
    assert.equal(headers.get("x-revalidate-secret"), "configured-secret-16");
  });
});

describe("notifySeoIndexChanged", () => {
  it("is a no-op when the landing URL and secret are missing", () => {
    let fetchCalled = false;
    notifySeoIndexChanged({
      landingAppUrl: undefined,
      secret: undefined,
      fetchImpl: (async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      }) as typeof fetch,
      schedule: (task) => {
        void task;
      }
    });

    assert.equal(fetchCalled, false);
  });

  it("schedules a single POST when configured", async () => {
    const calls: string[] = [];
    const scheduled: Promise<unknown>[] = [];

    notifySeoIndexChanged({
      landingAppUrl: "https://tessa.com.br",
      secret: "configured-secret-16",
      fetchImpl: (async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ revalidated: true }), { status: 200 });
      }) as typeof fetch,
      schedule: (task) => {
        scheduled.push(task);
      }
    });

    await Promise.all(scheduled);
    assert.deepEqual(calls, ["https://tessa.com.br/api/revalidate-seo-index"]);
  });
});

describe("notifySeoIndexChanged call sites", () => {
  it("is invoked from publish, blog mutations and translation processing", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const here = dirname(fileURLToPath(import.meta.url));
    const content = readFileSync(
      join(here, "../../content/content.service.ts"),
      "utf8"
    );
    const blog = readFileSync(join(here, "../../blog/blog.service.ts"), "utf8");
    const translation = readFileSync(
      join(here, "../../translation/translation.service.ts"),
      "utf8"
    );

    assert.match(content, /export async function publishMainContent/);
    assert.match(content, /notifySeoIndexChanged\(\)/);
    assert.equal((blog.match(/notifySeoIndexChanged\(\)/g) ?? []).length, 3);
    assert.match(translation, /processEntityTranslations/);
    assert.match(translation, /notifySeoIndexChanged\(\)/);
  });
});
