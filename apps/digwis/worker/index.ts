// Cloudflare Worker entry point. Nextion-routed requests (health,
// storage, notion media) are handled by `createNextionWorker`
// before falling through to the vinext app router.

import handler from "vinext/server/app-router-entry";
import { createNextionWorker } from "@notionx/core/worker";
import { authConfig } from "../lib/auth.config";
import { adminNav } from "../lib/admin/nav";
import { siteConfig } from "../lib/site/config";
import { runWithRequestEnv } from "../lib/site/request-env";
import { blogSource } from "../lib/content/models";

const nextion = createNextionWorker({
  sources: [blogSource],
  adminNav,
  authConfig,
  siteConfig: {
    name: siteConfig.name,
    description: siteConfig.description,
    defaultLocale: siteConfig.defaultLocale,
    locales: [...siteConfig.locales],
    navigation: siteConfig.navigation.main as unknown as unknown[],
  },
});

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Make `env` reachable from any async code path (RSC server
    // components, server actions, Notion content loaders, etc.) via
    // `getRequestEnv()`. See `lib/site/request-env.ts` for the
    // rationale — we cannot use `cloudflare:workers.getRequestContext`
    // because that module does not export it.
    return runWithRequestEnv(env, async () => {
      const nextionResponse = await nextion.fetch(request, env, ctx);
      if (nextionResponse) return nextionResponse;
      return handler.fetch(request, env, ctx);
    });
  },
};
