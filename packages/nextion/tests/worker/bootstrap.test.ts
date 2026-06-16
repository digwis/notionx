import { describe, it, expect, vi } from "vitest";
import { createNotionxWorker } from "../../src/worker/bootstrap";
import type { FoundationWorkerOptions } from "../../src/worker/bootstrap";
import type { SearchAdapter } from "../../src/search/adapter";

const baseOptions: FoundationWorkerOptions = {
  sources: [],
  adminNav: [],
  authConfig: {
    databaseBinding: "DB",
    tables: {
      users: "users",
      sessions: "sessions",
      passwordResets: "password_resets",
      emailVerifications: "email_verifications",
      authRateLimits: "auth_rate_limits",
    },
    sessionCookie: { name: "vinext_session", maxAge: 1, secure: true },
    roles: { default: "user", vip: "vip", admin: "admin" },
  },
  siteConfig: {
    name: "Test",
    description: "d",
    defaultLocale: "en",
    locales: ["en"],
    navigation: [],
  },
};

describe("createNotionxWorker", () => {
  it("returns a fetch handler", () => {
    const handler = createNotionxWorker(baseOptions);
    expect(typeof handler.fetch).toBe("function");
  });

  it("returns null when no route matches the path", async () => {
    const handler = createNotionxWorker(baseOptions);
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/some/unknown/path");
    const result = await handler.fetch(request, env, ctx);
    expect(result).toBeNull();
  });

  it("blocks /api/admin paths without a viewer cookie", async () => {
    const handler = createNotionxWorker(baseOptions);
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/admin/users", {
      method: "GET",
    });
    const result = await handler.fetch(request, env, ctx);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it("invokes extraRoutes when path matches", async () => {
    const extraHandler = vi
      .fn()
      .mockResolvedValue(new Response("from extra route", { status: 200 }));
    const handler = createNotionxWorker({
      ...baseOptions,
      extraRoutes: {
        "/api/custom": () =>
          Promise.resolve({
            default: extraHandler as unknown as FoundationWorkerOptions["extraRoutes"] extends Record<string, () => Promise<{ default: infer H }>> ? H : never,
          }),
      },
    });
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/custom");
    const result = await handler.fetch(request, env, ctx);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(200);
    expect(extraHandler).toHaveBeenCalledTimes(1);
  });

  it("does not register /api/search when searchAdapter is absent", async () => {
    const handler = createNotionxWorker(baseOptions);
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/search?q=test");
    const result = await handler.fetch(request, env, ctx);
    expect(result).toBeNull();
  });

  it("registers /api/search when searchAdapter is provided", async () => {
    const mockAdapter: SearchAdapter = {
      index: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([
        { modelId: "blog", routeId: "hello-world", title: "Hello", summary: "World" },
      ]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteForModel: vi.fn().mockResolvedValue(undefined),
      getMissingRouteIds: vi.fn().mockResolvedValue([]),
    };
    const handler = createNotionxWorker({
      ...baseOptions,
      searchAdapter: mockAdapter,
    });
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/search?q=hello&modelId=blog");
    const result = await handler.fetch(request, env, ctx);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(200);
    expect(mockAdapter.query).toHaveBeenCalledWith({
      query: "hello",
      modelId: "blog",
      limit: 20,
    });
    const body = (await result?.json()) as { results: Array<{ routeId: string }> };
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.routeId).toBe("hello-world");
  });

  it("returns empty results for empty query when searchAdapter is present", async () => {
    const mockAdapter: SearchAdapter = {
      index: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteForModel: vi.fn().mockResolvedValue(undefined),
      getMissingRouteIds: vi.fn().mockResolvedValue([]),
    };
    const handler = createNotionxWorker({
      ...baseOptions,
      searchAdapter: mockAdapter,
    });
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/search?q=");
    const result = await handler.fetch(request, env, ctx);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(200);
    expect(mockAdapter.query).not.toHaveBeenCalled();
    const body = (await result?.json()) as { results: unknown[] };
    expect(body.results).toEqual([]);
  });
});
