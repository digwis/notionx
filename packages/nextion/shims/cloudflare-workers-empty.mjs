// Empty shim for `cloudflare:workers` used by vitest only.
// The real `cloudflare:workers` module is provided at runtime by workerd
// (in the worker environment) and by @cloudflare/vite-plugin in the rsc/ssr
// Vite environments. The vitest tests never execute the code; they just
// need the import to resolve so module loading does not error.
export const env = {};
export default { env };
