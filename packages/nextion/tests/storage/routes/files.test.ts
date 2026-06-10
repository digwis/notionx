import { describe, it, expect } from "vitest";

import {
  cdnRoute,
  GET,
  cdnRouteHandle,
} from "../../../src/storage/routes/cdn";
import { filesRoute, GET as FILES_GET, filesRouteHandle } from "../../../src/storage/routes/files";
import { healthRoute, GET as HEALTH_GET, healthRouteHandle } from "../../../src/worker/routes/health";
import { notionMediaRoute, GET as NOTION_MEDIA_GET, notionMediaRouteHandle } from "../../../src/media/routes/notion-media";
import { createContentRevalidateRoute } from "../../../src/worker/routes/content-revalidate";
import { createContentPrewarmRoute } from "../../../src/worker/routes/content-prewarm";
import { createNotionWebhookRoute } from "../../../src/notion/routes/webhook";

describe("storage/routes/files - shape", () => {
  it("exposes the route object and a flat GET export", () => {
    expect(typeof filesRoute.GET).toBe("function");
    expect(typeof filesRoute.handle).toBe("function");
    expect(FILES_GET).toBe(filesRoute.GET);
  });

  it("exposes a worker-friendly single-arg handle alias", () => {
    expect(typeof filesRouteHandle).toBe("function");
  });
});

describe("storage/routes/cdn - shape", () => {
  it("exposes the route object and a flat GET export", () => {
    expect(typeof cdnRoute.GET).toBe("function");
    expect(typeof cdnRoute.handle).toBe("function");
    expect(GET).toBe(cdnRoute.GET);
  });

  it("exposes a worker-friendly single-arg handle alias", () => {
    expect(typeof cdnRouteHandle).toBe("function");
  });
});

describe("worker/routes/health - shape", () => {
  it("exposes the route object and a flat GET export", () => {
    expect(typeof healthRoute.GET).toBe("function");
    expect(typeof healthRoute.handle).toBe("function");
    expect(HEALTH_GET).toBe(healthRoute.GET);
  });

  it("exposes a worker-friendly single-arg handle alias", () => {
    expect(typeof healthRouteHandle).toBe("function");
  });
});

describe("media/routes/notion-media - shape", () => {
  it("exposes the route object and a flat GET export", () => {
    expect(typeof notionMediaRoute.GET).toBe("function");
    expect(typeof notionMediaRoute.handle).toBe("function");
    expect(NOTION_MEDIA_GET).toBe(notionMediaRoute.GET);
  });

  it("exposes a worker-friendly single-arg handle alias", () => {
    expect(typeof notionMediaRouteHandle).toBe("function");
  });
});

describe("worker/routes/content-revalidate - factory", () => {
  it("returns GET/POST/handle handlers", () => {
    const revalidateContentModel = async () => ({
      ok: true as const,
      model: {
        id: "blog",
        routes: { listPath: "/blog", detailPath: "/blog/[id]" },
      },
      revalidatedPaths: ["/blog"],
      contentCache: { ok: true, skipped: false, deleted: [], failed: [] },
      searchIndex: { ok: true, skipped: false, deleted: [], failed: [] },
    });

    const route = createContentRevalidateRoute({
      revalidatePath: () => undefined,
      authorizeContentRevalidate: () => true,
      readContentRevalidateRequest: async () => ({
        modelId: "blog",
        pageId: "p1",
      }),
      readContentRevalidateRequestFromUrl: () => null,
      revalidateContentModel: revalidateContentModel as never,
      getVerificationToken: async () => "secret",
      getDatabase: () => null,
      getContentCache: () => null,
    });

    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(typeof route.handle).toBe("function");
  });
});

describe("worker/routes/content-prewarm - factory", () => {
  it("returns a POST handler", () => {
    const prewarmPublicContentSearchIndex = async () => ({
      ok: true,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      models: [],
    });

    const route = createContentPrewarmRoute({
      authorizeContentRevalidate: () => true,
      prewarmPublicContentSearchIndex,
      getVerificationToken: async () => "secret",
    });

    expect(typeof route.POST).toBe("function");
  });
});

describe("notion/routes/webhook - factory", () => {
  it("returns POST/handle handlers", () => {
    const revalidateContentModel = async () => ({
      ok: true as const,
      model: {
        id: "blog",
        routes: { listPath: "/blog", detailPath: "/blog/[id]" },
      },
      revalidatedPaths: [],
      contentCache: { ok: true, skipped: false, deleted: [], failed: [] },
      searchIndex: { ok: true, skipped: false, deleted: [], failed: [] },
    });

    const route = createNotionWebhookRoute({
      revalidatePath: () => undefined,
      revalidateContentModel: revalidateContentModel as never,
      parseNotionWebhookPayload: async () => ({ type: "events", events: [] }),
    });

    expect(typeof route.POST).toBe("function");
    expect(typeof route.handle).toBe("function");
  });
});
