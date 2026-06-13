import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { fileURLToPath } from "node:url";

/**
 * Provide empty shims for `cloudflare:workers` and `next/headers` in the
 * client environment only. The cloudflare vite plugin resolves these
 * virtual modules in the rsc/ssr environments, and workerd provides
 * them at runtime. The client pre-bundle scan never executes the code;
 * it just needs the import to resolve.
 */
function serverOnlyShimsForClient(): Plugin {
  return {
    name: "vinext:server-only-shims-for-client",
    enforce: "pre",
    resolveId(id) {
      if (this.environment?.name !== "client") return null;
      if (id === "cloudflare:workers") {
        return fileURLToPath(
          new URL("./shims/cloudflare-workers-empty.mjs", import.meta.url),
        );
      }
      if (id === "next/headers") {
        return fileURLToPath(
          new URL("./shims/next-headers-empty.mjs", import.meta.url),
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    // `kvDataAdapter()` is a config-time builder: it just returns a
    // serializable descriptor pointing at the runtime KV cache factory.
    // The actual KV handler is instantiated lazily on the first request
    // (it reads the `VINEXT_KV_CACHE` binding from `env`), so this is
    // safe to call from `vite.config.ts` — it never touches workerd.
    vinext({ cache: { data: kvDataAdapter() } }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
    tailwindcss(),
    serverOnlyShimsForClient(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
