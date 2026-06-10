import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const cloudflareWorkersShim = fileURLToPath(
  new URL("./shims/cloudflare-workers-empty.mjs", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": cloudflareWorkersShim,
    },
  },
  test: {
    environment: "node",
  },
});
