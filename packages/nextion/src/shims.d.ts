// Ambient declarations for runtime shims that are resolved by the
// consumer (the starter, the Cloudflare Workers runtime, or the
// vinext/Next.js server) and that this package lists as
// `external` in its tsup config. The declarations here only provide
// types so the package can build; the actual implementations live
// in the consumer.

declare module "cloudflare:workers" {
  // The shape of `env` is defined by the consumer (e.g. the
  // starter's env.d.ts). This ambient declaration intentionally
  // stays loose; the package never reads `env` directly.
  export const env: Record<string, unknown>;
  export const ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}

declare module "vinext/shims/request-context" {
  /**
   * Returns the current request's execution context, exposing
   * `waitUntil` so background work can be scheduled alongside the
   * request. The shim is provided by the consumer (the starter or
   * the vinext/Next.js runtime).
   */
  export function getRequestExecutionContext(): {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  } | undefined;
}
