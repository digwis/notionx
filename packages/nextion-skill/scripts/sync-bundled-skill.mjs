// Copy skill content from the monorepo root into this package's `skill/`
// directory so it ships with the published npm package. Run automatically
// before build/test via npm scripts.
import { cp, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = resolve(__dirname, "..");
const root = resolve(here, "..", "..");
const src = resolve(root, "skills", "nextion");
const dest = resolve(here, "skill");
const tmp = resolve(here, `.skill-tmp-${process.pid}-${Date.now()}`);

if (!existsSync(src)) {
  console.error(`[nextion-skill] skill source not found at ${src}`);
  process.exit(1);
}

await rm(tmp, { recursive: true, force: true });
await cp(src, tmp, { recursive: true });
await rm(dest, { recursive: true, force: true });
try {
  await rename(tmp, dest);
} catch (err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  if (code !== "EEXIST" && code !== "ENOTEMPTY") throw err;
  await rm(dest, { recursive: true, force: true });
  await rename(tmp, dest);
}
await rm(tmp, { recursive: true, force: true });
console.log(`[nextion-skill] synced ${src} -> ${dest}`);
