import vinext from "vinext";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

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
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
