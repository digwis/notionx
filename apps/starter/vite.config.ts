import vinext from "vinext";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

/**
 * Provide empty shims for `cloudflare:workers` and `next/headers` in the
 * client environment only. The cloudflare vite plugin resolves these
 * virtual modules in the rsc/ssr environments, and workerd provides them
 * at runtime. The client pre-bundle scan never executes the code; it just
 * needs the import to resolve so vite:import-analysis does not error.
 */
function serverOnlyShimsForClient(): Plugin {
  return {
    name: "vinext:server-only-shims-for-client",
    enforce: "pre",
    resolveId(id) {
      if (this.environment?.name !== "client") return null;
      if (id === "cloudflare:workers") {
        return fileURLToPath(
          new URL("./shims/cloudflare-workers-empty.js", import.meta.url),
        );
      }
      if (id === "next/headers") {
        return fileURLToPath(
          new URL("./shims/next-headers-empty.js", import.meta.url),
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    vinext({
      // Route-level ISR/CDN caching and vinext data cache (revalidatePath, fetch cache).
      cache: {
        cdn: cdnAdapter(),
        data: kvDataAdapter({
          binding: "CONTENT_CACHE",
          appPrefix: "vinext",
        }),
      },
    }),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
    tailwindcss(),
    serverOnlyShimsForClient(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
