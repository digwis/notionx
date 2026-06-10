// Empty shim for `cloudflare:workers` used only by the client-side
// import-analysis pre-bundle scan. The real `cloudflare:workers` module is
// provided at runtime by workerd (in the worker environment) and by
// @cloudflare/vite-plugin in the rsc/ssr Vite environments. This file is
// never executed in the browser — vite's import-analysis just needs every
// named import to resolve so it doesn't error during the client bundle
// scan. We export a frozen proxy whose property access returns undefined,
// matching the shape that production code (e.g. `workerEnv.SITE_URL`)
// tolerates.
export const env = new Proxy(
  {},
  {
    get: () => undefined,
    has: () => false,
  },
);
