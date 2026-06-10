// Re-export of internal/admin/admin from the package. The starter used
// to ship its own copy; the canonical version now lives in
// @vinext/foundation's internal/admin folder.

export {
  DEFAULT_ADMIN_EMAIL,
  ensureAdminUser,
  isAdminEmail,
  normalizeEmail,
} from "@vinext/foundation/internal-admin";
