// Wires the package's Notion webhook route to the starter's content
// revalidation logic.
//
// The package's `createNotionWebhookRoute` is a factory; the starter
// plugs in its `revalidateContentModel` (which knows the project's
// content models) and the wrapper that injects the project's models
// into the webhook parser.
import { revalidatePath } from "next/cache";
import { createNotionWebhookRoute } from "@vinext/foundation/notion/routes/webhook";
import { revalidateContentModel } from "@/lib/content/revalidate";
import { parseNotionWebhookPayloadWithPageLookup } from "@/lib/notion/webhook";

const notionWebhookRoute = createNotionWebhookRoute({
  revalidatePath,
  revalidateContentModel,
  parseNotionWebhookPayload: parseNotionWebhookPayloadWithPageLookup,
});

export const POST = notionWebhookRoute.POST;
