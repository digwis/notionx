// Wires the package's content revalidate route to the starter's
// content model revalidation logic.
//
// The package's `createContentRevalidateRoute` is a factory; the
// starter plugs in its `revalidateContentModel` (which knows the
// project's content models) and the runtime helpers that resolve the
// database and content cache.
import { revalidatePath } from "next/cache";
import { createContentRevalidateRoute } from "@vinext/foundation/worker/routes/content-revalidate";
import { getNotionWebhookVerificationToken } from "@vinext/foundation/notion/config";
import { getRuntimePlatform } from "@vinext/foundation/platform/current";
import {
  authorizeContentRevalidate,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  revalidateContentModel,
} from "@/lib/content/revalidate";

const contentRevalidateRoute = createContentRevalidateRoute({
  revalidatePath,
  authorizeContentRevalidate,
  readContentRevalidateRequest,
  readContentRevalidateRequestFromUrl,
  revalidateContentModel,
  getVerificationToken: () => getNotionWebhookVerificationToken(),
  getDatabase: () => getRuntimePlatform().database,
  getContentCache: () => getRuntimePlatform().keyValueCache,
});

export const POST = contentRevalidateRoute.POST;
export const GET = contentRevalidateRoute.GET;
