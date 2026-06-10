import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const cloudflareWorkersShim = fileURLToPath(
  new URL("./shims/cloudflare-workers-empty.mjs", import.meta.url)
);
const requestContextShim = fileURLToPath(
  new URL("./shims/request-context-empty.mjs", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": cloudflareWorkersShim,
      "vinext/shims/request-context": requestContextShim,
    },
  },
  test: {
    environment: "node",
  },
});
