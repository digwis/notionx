// Public surface for the @vinext/foundation/auth/routes subpath.
//
// The package ships standalone Next.js route handlers. Consuming
// apps re-export them from their own `app/api/auth/<name>/route.ts`
// file (or import them directly via the subpath).
export { GET as googleGET } from "./google";
export { GET as googleCallbackGET } from "./google-callback";
export { GET as verifyEmailGET } from "./verify-email";
export { GET as viewerGET } from "./viewer";

// Aggregate route map. Useful for `createFoundationWorker` to wire
// the auth API surface into the Cloudflare Worker fetch handler.
export const authRoutes = {
  "/api/auth/google": { GET: "./google" },
  "/api/auth/google/callback": { GET: "./google-callback" },
  "/api/auth/verify-email": { GET: "./verify-email" },
  "/api/auth/viewer": { GET: "./viewer" },
} as const;
