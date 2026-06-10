// Public surface for the @vinext/foundation/auth subpath.
//
// Phase 3.1 lands the factory and the public types. The session, users,
// rate-limit, and turnstile internals are added in Task 3.2; consumers
// already get a fully-typed `Auth` object so the rest of the auth stack
// can be wired up incrementally.
export { createAuth } from "./auth";
export type {
  Auth,
  AuthUser,
  AuthViewer,
  AuthRateLimitResult,
} from "./auth";
