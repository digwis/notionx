// Delegates to the @vinext/foundation package's CLI, which reads
// wrangler.jsonc, .env.local, and .dev.vars from the current working
// directory and prints the foundation doctor report.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const child = spawn(
  "pnpm",
  ["--filter", "@vinext/foundation", "foundation:doctor", ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() }
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

// repoRoot kept as a sanity check so the script fails fast if it is
// moved out of the monorepo.
void repoRoot;
