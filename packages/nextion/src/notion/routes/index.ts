// Public surface for the @notionx/core/notion/routes subpath.
//
// The webhook route is a factory function that takes the
// revalidation logic as a parameter. The starter wires its
// implementation in via `createNotionWebhookRoute`.
export { createNotionWebhookRoute } from "./webhook";
export type {
  CreateNotionWebhookRouteOptions,
  NotionWebhookParserFn,
  RevalidateContentModelFromWebhookFn,
} from "./webhook";
