// packages/create-nextion-app/src/nextion-source.ts
//
// Resolves the `notionxSource` semver range that the scaffolder
// writes into the generated `package.json`'s
// `@notionx/core` / `@notionx/create-notionx-app` entries.
//
// Resolution order (highest priority first):
//
//   1. Explicit override (`--nextion-source <range>` or
//      the interactive prompt).
//   2. **Monorepo dev mode** — the user is running the scaffolder
//      from inside the `notionx` monorepo (or from a workspace
//      consumer such as `notionx/apps/<app>`). When we can see
//      `packages/nextion/package.json` two directories up from the
//      target dir, we emit `workspace:*` so the generated project
//      resolves `@notionx/core` against the local checkout via
//      pnpm workspace symlinks. This is the path scaffolder
//      authors use to iterate on `core` without publish / install
//      round-trips.
//   3. Live npm registry — fetch `@notionx/core`'s `dist-tags.latest`
//      and emit `^<version>`. The fetch has a 5s timeout.
//   4. Hardcoded `FALLBACK_NOTIONX_SOURCE` range — used when the
//      registry is unreachable. Bump in lockstep with releases.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Last-known-good fallback used when the npm registry lookup
 * fails (network down, registry behind a proxy, 5xx, etc.).
 *
 * Bump this in lockstep with the latest published release — but
 * note that any *in-flight* release cycle should accept a slightly
 * stale fallback over refusing to install.
 *
 * Exported so the prompt / answers modules can reference the same
 * source of truth instead of duplicating the literal — duplicate
 * strings drifted out of sync in 0.5.x and produced un-installable
 * scaffolds (`ERR_PNPM_NO_MATCHING_VERSION` for `@notionx/core@^0.5.2`).
 */
export const FALLBACK_NOTIONX_SOURCE = "^1.0.0";

const REGISTRY_TIMEOUT_MS = 5_000;

/**
 * Marker written into the generated `.notionx/scaffold.json` and
 * `package.json` so downstream tools (the `update` command, the
 * doctor, etc.) can tell that this project was generated in
 * monorepo dev mode and should be upgraded by re-running the
 * scaffolder rather than by pulling a new semver from npm.
 */
export const MONOREPO_PROTOCOL = "workspace:*";

/**
 * Returns true when the scaffold target lives inside the `notionx`
 * monorepo — i.e. we can see the monorepo root two directories up
 * from the target. Both the monorepo root and `apps/<name>` consumers
 * qualify, as do any depth-2 or shallower workspace packages.
 *
 * We probe the resolved real path of `packages/nextion/package.json`
 * (not the symlink) to avoid false negatives inside worktrees.
 */
export function isMonorepoDevMode(targetDir: string): boolean {
  try {
    // Walk up from the target directory looking for a sibling
    // `packages/nextion/package.json` whose name is `@notionx/core`.
    // We probe upward (not just two levels) so the detector works
    // for both shallow (`notionx/apps/digwis`) and nested
    // (`notionx/apps/scratch/digwis`) layouts, and for worktrees
    // checked out anywhere under the monorepo root.
    let cursor = resolve(targetDir);
    for (let i = 0; i < 6; i++) {
      const probe = resolve(cursor, "packages", "notionx", "package.json");
      if (existsSync(probe)) {
        const contents = readFileSync(probe, "utf8");
        if (/"name"\s*:\s*"@notionx\/core"/.test(contents)) {
          return true;
        }
      }
      const parent = resolve(cursor, "..");
      if (parent === cursor) break; // filesystem root
      cursor = parent;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolved semver range the scaffolder should write into the
 * generated project.
 *
 * If the caller passed an explicit range (via `--nextion-source`
 * or the interactive prompt), that wins. Otherwise, if the
 * target is inside the `notionx` monorepo, we emit `workspace:*`
 * for the local-dev fast path. Otherwise we hit the npm registry
 * for `@notionx/core`'s `dist-tags.latest` and prefix it with `^`
 * so the generated project picks up compatible updates.
 */
export async function resolveNotionxSource(
  override: string | undefined,
  targetDir: string
): Promise<string> {
  if (override !== undefined && override !== "") {
    return override;
  }
  if (isMonorepoDevMode(targetDir)) {
    return MONOREPO_PROTOCOL;
  }
  try {
    const version = await fetchLatestCoreVersion();
    if (version) {
      return `^${version}`;
    }
  } catch {
    // Swallow — fall through to the hardcoded fallback below.
  }
  return FALLBACK_NOTIONX_SOURCE;
}

/**
 * Fetches `@notionx/core`'s `dist-tags.latest` from the public
 * npm registry, with a hard timeout. Returns `null` on any error
 * (timeout, non-2xx, malformed JSON, missing field) so the caller
 * can fall back without needing to know what went wrong.
 */
async function fetchLatestCoreVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);
  try {
    const response = await fetch(
      "https://registry.npmjs.org/@notionx/core/latest",
      { signal: controller.signal }
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { version?: unknown };
    if (typeof data.version !== "string" || data.version.length === 0) {
      return null;
    }
    return data.version;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
