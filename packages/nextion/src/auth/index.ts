// Public surface for the @nextion/core/auth subpath.
//
// The `createAuth` factory and its `Auth` interface are the public API.
// Internal helpers (session, users, rate-limit, turnstile, passwords)
// are also re-exported so the starter's re-export shims and existing
// server actions can keep using the same import paths.

export { createAuth } from "./auth";
export type {
  Auth,
  AuthUser,
  AuthRateLimitResult,
} from "./auth";

export type { SessionUser } from "./session";
export {
  ADMIN_COOKIE,
  USER_COOKIE,
  checkPassword,
  clearSessionCookie,
  clearUserSessionCookie,
  getAuthViewer,
  getCurrentUser,
  isAuthenticated,
  setSessionCookie,
  setUserSessionCookie,
  signUserToken,
  verifyUserToken,
} from "./user-session";
export type { AuthViewer } from "./user-session";
export {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "./passwords";
export type { User, UserRole, UserListItem } from "./users";
export {
  authenticateEmailUser,
  changeUserPassword,
  createEmailUser,
  deleteUserAccount,
  getUserByEmail,
  getUserById,
  issuePasswordResetToken,
  issueVerificationToken,
  listUsers,
  listUsersWithPostCounts,
  normalizeUserRole,
  resetPasswordWithToken,
  revokeUserSessions,
  setUserRole,
  upsertGoogleUser,
  userToSession,
  verifyEmailUser,
} from "./users";
export {
  checkAuthRateLimit,
  clearAuthRateLimit,
  clearAuthRateLimits,
  enforceAuthRateLimits,
  recordAuthFailure,
  recordAuthFailures,
} from "./rate-limit";
export type { AuthRateLimitKind } from "./rate-limit";
export {
  getTurnstileRuntimeConfig,
  verifyTurnstileFromForm,
  verifyTurnstileToken,
} from "./turnstile";
export type { TurnstileRuntimeConfig } from "./turnstile";
