// Re-export of internal/admin/settings from the package. The starter
// used to ship its own copy; the canonical version now lives in
// @vinext/foundation's internal/admin folder.

export {
  getAppSettings,
  getTurnstilePublicConfig,
  getGoogleOAuthConfig,
  updateTurnstileConfig,
  disableTurnstileConfig,
  updateGoogleOAuthConfig,
  clearGoogleOAuthConfig,
  updateSiteTitle,
} from "@vinext/foundation/internal-admin";
