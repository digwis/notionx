// Empty shim for `cloudflare:workers` used only by the client-side
// import-analysis pre-bundle scan. The real `cloudflare:workers` module is
// provided at runtime by workerd (in the worker environment) and by
// @cloudflare/vite-plugin in the rsc/ssr Vite environments. This file is
// never executed in the browser.
export {};
