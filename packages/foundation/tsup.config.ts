import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
    "util/index": "src/util/index.ts",
    "i18n/index": "src/i18n/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "platform/index": "src/platform/index.ts",
    "cache/index": "src/cache/index.ts",
    "notion/index": "src/notion/index.ts",
    "content/index": "src/content/index.ts",
    "auth/index": "src/auth/index.ts",
    "auth/auth-pages/index": "src/auth/auth-pages/index.ts",
    "auth/routes/index": "src/auth/routes/index.ts",
    "storage/index": "src/storage/index.ts",
    "media/index": "src/media/index.ts",
    "email/index": "src/email/index.ts",
    "admin/index": "src/admin/index.ts",
    "admin/pages/index": "src/admin/pages/index.ts",
    "doctor/index": "src/doctor/index.ts",
    "doctor/cli": "src/doctor/cli.ts",
    "worker/index": "src/worker/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "es2022",
  // Virtual modules and consumer runtime modules must not be bundled.
  // Consumers (the starter) resolve these at runtime in Cloudflare Workers
  // or in the vinext/Next.js runtime.
  external: ["cloudflare:workers", "next/headers", "next/server"],
});
