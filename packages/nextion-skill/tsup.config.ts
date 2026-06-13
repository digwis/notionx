import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  shims: false,
  dts: true,
  // No bundling of node_modules; we ship a pure ESM CLI.
  external: ["node:*"],
});
