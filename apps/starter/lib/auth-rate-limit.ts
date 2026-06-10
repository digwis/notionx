// Re-export of @vinext/foundation/auth/rate-limit for backward compatibility.
export {
  checkAuthRateLimit,
  clearAuthRateLimit,
  clearAuthRateLimits,
  enforceAuthRateLimits,
  recordAuthFailure,
  recordAuthFailures,
} from "@vinext/foundation/auth/rate-limit";
export type { AuthRateLimitKind } from "@vinext/foundation/auth/rate-limit";
