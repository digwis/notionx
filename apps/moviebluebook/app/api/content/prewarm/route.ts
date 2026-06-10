// Wires the package's content prewarm route to the starter's
// prewarm logic.
//
// The package's `createContentPrewarmRoute` is a factory; the
// starter plugs in its `prewarmPublicContentSearchIndex` (which knows
// the project's content models) and the runtime helpers that
// authorize the request and resolve the webhook verification token.
import { createContentPrewarmRoute } from "@vinext/foundation/worker/routes/content-prewarm";
import { getNotionWebhookVerificationToken } from "@vinext/foundation/notion/config";
import { authorizeContentRevalidate } from "@/lib/content/revalidate";
import { prewarmPublicContentSearchIndex } from "@/lib/content/prewarm";

const contentPrewarmRoute = createContentPrewarmRoute({
  authorizeContentRevalidate,
  prewarmPublicContentSearchIndex,
  getVerificationToken: () => getNotionWebhookVerificationToken(),
});

export const POST = contentPrewarmRoute.POST;
