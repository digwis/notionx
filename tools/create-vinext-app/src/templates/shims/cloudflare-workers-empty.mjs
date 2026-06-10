// Minimal shim for `cloudflare:workers` in the client environment.
// The real module is resolved by the @cloudflare/vite-plugin in the
// rsc/ssr environments; the client bundle scan never executes this.
export {};
