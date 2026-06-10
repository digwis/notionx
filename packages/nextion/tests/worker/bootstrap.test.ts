import { describe, it, expect, vi } from "vitest";
import { createNextionWorker } from "../../src/worker/bootstrap";
import type { FoundationWorkerOptions } from "../../src/worker/bootstrap";

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

describe("createNextionWorker", () => {
  it("returns a fetch handler", () => {
    const handler = createNextionWorker(baseOptions);
    expect(typeof handler.fetch).toBe("function");
  });

  it("returns null when no route matches the path", async () => {
    const handler = createNextionWorker(baseOptions);
    const env = {} as unknown as Record<string, unknown>;
    const ctx = {} as unknown as ExecutionContext;
    const request = new Request("https://example.com/some/unknown/path");
    const result = await handler.fetch(request, env, ctx);
    expect(result).toBeNull();
  });

  it("blocks /api/admin paths without a viewer cookie", async () => {
    const handler = createNextionWorker(baseOptions);
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
    const handler = createNextionWorker({
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
});
