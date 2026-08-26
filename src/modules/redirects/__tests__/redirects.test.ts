import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Redirect } from "@prisma/client";
import { HTTPException } from "hono/http-exception";
import {
  createRedirect,
  listPublicRedirects,
  listRedirects,
  normalizePath,
  recordSlugChangeRedirect,
  releaseRedirectOccupyingPath
} from "../redirects.service.js";

process.env.TRANSLATION_ENABLED = "false";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.DATABASE_URL_UNPOOLED ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-jwt-secret-with-16-characters";
process.env.MASTER_SETUP_KEY ??= "test-setup-key";

type StoredRedirect = Redirect;

function now(): Date {
  return new Date("2026-08-25T12:00:00.000Z");
}

function createRow(
  input: Partial<StoredRedirect> & Pick<StoredRedirect, "fromPath" | "toPath">
): StoredRedirect {
  return {
    id: input.id ?? `redirect-${input.fromPath}`,
    fromPath: input.fromPath,
    toPath: input.toPath,
    statusCode: input.statusCode ?? 301,
    source: input.source ?? "manual",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    createdAt: input.createdAt ?? now(),
    updatedAt: input.updatedAt ?? now()
  };
}

async function loadPrisma() {
  const { prisma } = await import("../../../lib/prisma.js");
  return prisma;
}

async function installRedirectStore(seed: StoredRedirect[] = []) {
  const prisma = await loadPrisma();
  const rows = new Map<string, StoredRedirect>(seed.map((row) => [row.fromPath, row]));

  function values(): StoredRedirect[] {
    return [...rows.values()];
  }

  Object.defineProperty(prisma.redirect, "findUnique", {
    configurable: true,
    value: async ({ where }: { where: { id?: string; fromPath?: string } }) => {
      if (where.id) return values().find((row) => row.id === where.id) ?? null;
      if (where.fromPath) return rows.get(where.fromPath) ?? null;
      return null;
    }
  });

  Object.defineProperty(prisma.redirect, "findMany", {
    configurable: true,
    value: async ({
      orderBy
    }: {
      orderBy?: { fromPath: "asc" | "desc" };
    } = {}) => {
      const list = values();
      if (orderBy?.fromPath === "asc") {
        list.sort((a, b) => a.fromPath.localeCompare(b.fromPath));
      }
      return list;
    }
  });

  Object.defineProperty(prisma.redirect, "create", {
    configurable: true,
    value: async ({ data }: { data: Omit<StoredRedirect, "id" | "createdAt" | "updatedAt"> & { id?: string } }) => {
      const row = createRow({ ...data, id: data.id ?? `redirect-${String(rows.size + 1)}` });
      rows.set(row.fromPath, row);
      return row;
    }
  });

  Object.defineProperty(prisma.redirect, "update", {
    configurable: true,
    value: async ({
      where,
      data
    }: {
      where: { id: string };
      data: Partial<StoredRedirect>;
    }) => {
      const current = values().find((row) => row.id === where.id);
      if (!current) throw new Error("missing");
      rows.delete(current.fromPath);
      const next = { ...current, ...data, updatedAt: now() };
      rows.set(next.fromPath, next);
      return next;
    }
  });

  Object.defineProperty(prisma.redirect, "updateMany", {
    configurable: true,
    value: async ({
      where,
      data
    }: {
      where: { toPath: string };
      data: { toPath: string };
    }) => {
      let count = 0;
      for (const row of values()) {
        if (row.toPath !== where.toPath) continue;
        rows.set(row.fromPath, { ...row, toPath: data.toPath, updatedAt: now() });
        count += 1;
      }
      return { count };
    }
  });

  Object.defineProperty(prisma.redirect, "delete", {
    configurable: true,
    value: async ({ where }: { where: { id: string } }) => {
      const current = values().find((row) => row.id === where.id);
      if (!current) throw new Error("missing");
      rows.delete(current.fromPath);
      return current;
    }
  });

  Object.defineProperty(prisma.redirect, "deleteMany", {
    configurable: true,
    value: async ({
      where
    }: {
      where: { fromPath?: string; toPath?: string };
    }) => {
      let count = 0;
      for (const row of values()) {
        if (where.fromPath && row.fromPath !== where.fromPath) continue;
        if (where.toPath && row.toPath !== where.toPath) continue;
        if (where.fromPath && where.toPath && (row.fromPath !== where.fromPath || row.toPath !== where.toPath)) {
          continue;
        }
        rows.delete(row.fromPath);
        count += 1;
      }
      return { count };
    }
  });

  Object.defineProperty(prisma.redirect, "count", {
    configurable: true,
    value: async () => rows.size
  });

  Object.defineProperty(prisma.blogArticle, "findFirst", {
    configurable: true,
    value: async () => null
  });
  Object.defineProperty(prisma.blogArticle, "findMany", {
    configurable: true,
    value: async () => []
  });
  Object.defineProperty(prisma.landingPage, "findUnique", {
    configurable: true,
    value: async () => null
  });
  Object.defineProperty(prisma.landingPage, "findFirst", {
    configurable: true,
    value: async () => null
  });
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)
  });

  return { prisma, rows };
}

describe("normalizePath", () => {
  it("forces a leading slash, drops trailing slash, locale prefix, query and hash, and lowercases", () => {
    assert.equal(normalizePath("EN/Blog/Post-Antigo/?x=1#y"), "/blog/post-antigo");
    assert.equal(normalizePath("/es/servicos/Carport/"), "/servicos/carport");
    assert.equal(normalizePath("/quem-somos"), "/quem-somos");
  });
});

describe("createRedirect", () => {
  it("rejects a loop where origin and destination are the same", async () => {
    await installRedirectStore();
    await assert.rejects(
      () => createRedirect({ fromPath: "/blog/a", toPath: "/blog/a" }),
      (error: unknown) => error instanceof HTTPException && error.status === 400
    );
  });

  it("collapses a chain so /a → /b becomes /a → /c when /b → /c is created", async () => {
    const { rows } = await installRedirectStore([
      createRow({ id: "chain", fromPath: "/a", toPath: "/b" })
    ]);

    await createRedirect({ fromPath: "/b", toPath: "/c" });

    assert.equal(rows.get("/b")?.toPath, "/c");
    assert.equal(rows.get("/a")?.toPath, "/c");
  });

  it("stores the terminal destination when /b → /c already exists and /a → /b is created", async () => {
    const { rows } = await installRedirectStore([
      createRow({ id: "existing", fromPath: "/b", toPath: "/c" })
    ]);

    await createRedirect({ fromPath: "/a", toPath: "/b" });

    assert.equal(rows.get("/a")?.toPath, "/c");
    assert.equal(rows.get("/b")?.toPath, "/c");
  });

  it("rejects a cycle longer than a self-loop", async () => {
    await installRedirectStore([
      createRow({ id: "ab", fromPath: "/a", toPath: "/b" }),
      createRow({ id: "bc", fromPath: "/b", toPath: "/c" })
    ]);

    await assert.rejects(
      () => createRedirect({ fromPath: "/c", toPath: "/a" }),
      (error: unknown) => error instanceof HTTPException && error.status === 400
    );
  });

  it("rejects a fromPath that is still a live public page", async () => {
    await installRedirectStore();
    await assert.rejects(
      () => createRedirect({ fromPath: "/contato", toPath: "/quem-somos" }),
      (error: unknown) => error instanceof HTTPException && error.status === 400
    );
  });

  it("updates the destination when fromPath already exists", async () => {
    const { rows } = await installRedirectStore([
      createRow({ id: "existing", fromPath: "/blog/antigo", toPath: "/blog/meio" })
    ]);

    const updated = await createRedirect({
      fromPath: "/blog/antigo",
      toPath: "/blog/novo"
    });

    assert.equal(updated.id, "existing");
    assert.equal(rows.get("/blog/antigo")?.toPath, "/blog/novo");
    assert.equal(rows.size, 1);
  });
});

describe("listRedirects", () => {
  it("marks occupied origins and missing blog destinations", async () => {
    await installRedirectStore([
      createRow({
        id: "dead",
        fromPath: "/blog/antigo",
        toPath: "/blog/apagado",
        source: "slugChange",
        entityType: "blogArticle"
      }),
      createRow({
        id: "occupied",
        fromPath: "/blog/publicado",
        toPath: "/blog/outro"
      })
    ]);
    const prisma = await loadPrisma();
    Object.defineProperty(prisma.blogArticle, "findMany", {
      configurable: true,
      value: async () => [{ slug: "publicado" }]
    });

    const result = await listRedirects({ page: 1, perPage: 20 });
    const dead = result.redirects.find((row) => row.fromPath === "/blog/antigo");
    const occupied = result.redirects.find((row) => row.fromPath === "/blog/publicado");

    assert.equal(dead?.destinationMissing, true);
    assert.equal(dead?.sourceOccupied, false);
    assert.equal(occupied?.destinationMissing, true);
    assert.equal(occupied?.sourceOccupied, true);
  });
});

describe("recordSlugChangeRedirect", () => {
  it("creates /blog/old → /blog/new on a simple re-slug", async () => {
    const { rows } = await installRedirectStore();
    await recordSlugChangeRedirect({
      fromPath: "/blog/old",
      toPath: "/blog/new",
      entityType: "blogArticle",
      entityId: "article-1"
    });

    const created = rows.get("/blog/old");
    assert.equal(created?.toPath, "/blog/new");
    assert.equal(created?.source, "slugChange");
    assert.equal(created?.entityType, "blogArticle");
  });

  it("renaming A → B → A does not leave a loop or orphan", async () => {
    const { rows } = await installRedirectStore();
    await recordSlugChangeRedirect({
      fromPath: "/blog/a",
      toPath: "/blog/b",
      entityType: "blogArticle",
      entityId: "article-1"
    });
    await recordSlugChangeRedirect({
      fromPath: "/blog/b",
      toPath: "/blog/a",
      entityType: "blogArticle",
      entityId: "article-1"
    });

    assert.equal(rows.has("/blog/a"), false);
    assert.equal(rows.get("/blog/b")?.toPath, "/blog/a");
    assert.equal(rows.size, 1);
  });

  it("rewrites an existing redirect that already pointed at the new slug", async () => {
    const { rows } = await installRedirectStore([
      createRow({
        id: "old-to-current",
        fromPath: "/blog/a",
        toPath: "/blog/c",
        source: "slugChange"
      })
    ]);

    await recordSlugChangeRedirect({
      fromPath: "/blog/c",
      toPath: "/blog/d",
      entityType: "blogArticle",
      entityId: "article-1"
    });

    assert.equal(rows.get("/blog/a")?.toPath, "/blog/d");
    assert.equal(rows.get("/blog/c")?.toPath, "/blog/d");
  });

  it("does not overwrite a manual redirect on slug change", async () => {
    const { rows } = await installRedirectStore([
      createRow({
        id: "manual",
        fromPath: "/blog/old",
        toPath: "/blog/kept",
        source: "manual"
      })
    ]);

    await recordSlugChangeRedirect({
      fromPath: "/blog/old",
      toPath: "/blog/new",
      entityType: "blogArticle",
      entityId: "article-1"
    });

    assert.equal(rows.get("/blog/old")?.toPath, "/blog/kept");
    assert.equal(rows.get("/blog/old")?.source, "manual");
  });

  it("deletes a redirect when a live page occupies its fromPath", async () => {
    const { rows } = await installRedirectStore([
      createRow({ fromPath: "/blog/revived", toPath: "/blog/other" })
    ]);

    await releaseRedirectOccupyingPath("/blog/revived");
    assert.equal(rows.has("/blog/revived"), false);
  });
});

describe("redirects router", () => {
  it("requires authentication on admin routes and exposes a public payload without internal fields", async () => {
    const [{ redirectsRouter }, { createAccessToken }, { prisma }] = await Promise.all([
      import("../redirects.router.js"),
      import("../../../lib/auth.js"),
      import("../../../lib/prisma.js")
    ]);

    for (const [path, method] of [
      ["/", "GET"],
      ["/", "POST"],
      ["/id-1", "PUT"],
      ["/id-1", "DELETE"]
    ] as const) {
      const response = await redirectsRouter.request(path, { method });
      assert.equal(response.status, 401);
    }

    Object.defineProperty(prisma.redirect, "findMany", {
      configurable: true,
      value: async () => [
        createRow({
          id: "secret",
          fromPath: "/2023/05/post",
          toPath: "/blog/post",
          entityType: "blogArticle",
          entityId: "article-1"
        }),
        createRow({
          id: "later",
          fromPath: "/blog/old",
          toPath: "/blog/new"
        })
      ]
    });

    const publicResponse = await redirectsRouter.request("/public");
    assert.equal(publicResponse.status, 200);
    const payload = (await publicResponse.json()) as {
      redirects: Array<Record<string, unknown>>;
    };
    assert.deepEqual(payload.redirects, [
      { fromPath: "/2023/05/post", toPath: "/blog/post", statusCode: 301 },
      { fromPath: "/blog/old", toPath: "/blog/new", statusCode: 301 }
    ]);
    assert.equal("id" in payload.redirects[0], false);
    assert.equal("entityId" in payload.redirects[0], false);

    const token = await createAccessToken({
      id: "user-1",
      email: "admin@tessa.com.br",
      role: "ADMIN"
    });
    Object.defineProperty(prisma.user, "findUnique", {
      configurable: true,
      value: async () => ({
        id: "user-1",
        email: "admin@tessa.com.br",
        role: "ADMIN",
        isActive: true
      })
    });
    const authorized = await redirectsRouter.request("/", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.notEqual(authorized.status, 401);
  });
});
