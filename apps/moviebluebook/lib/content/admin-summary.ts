// Re-exports the foundation's content admin summary helpers. The
// foundation owns the generic `summarizeContentModelForAdmin` and
// `getContentModelAdminSummaries` implementations; the starter
// resolves its content models from the foundation's registry by
// default.
export {
  getContentModelAdminSummaries,
  summarizeContentModelForAdmin,
  type ContentModelAdminSummary,
} from "@vinext/foundation/content";
