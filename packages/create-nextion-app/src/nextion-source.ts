// packages/create-nextion-app/src/nextion-source.ts
//
// Resolves the `nextionSource` semver range that the scaffolder
// writes into the generated `package.json`'s
// `@notionx/core` / `@notionx/create-nextion-app` entries.
//
// The default reads the live version from the npm registry so
// freshly-installed scaffolds always match the latest published
// package — the previous default `^0.1.2` was a hardcoded value
// from very early in the project and silently broke pnpm install
// the moment the real version outgrew 0.1.x.
//
// The network call has a 5s timeout and falls back to a hardcoded
// caret range if the registry is unreachable, so a scaffolder never
// hangs because npm is down. The fallback is a *range* on purpose:
// we still want the generated project to pick up patch and minor
// updates without forcing the operator to re-scaffold.

/**
 * Last-known-good fallback used when the npm registry lookup
 * fails (network down, registry behind a proxy, 5xx, etc.).
 *
 * Bump this in lockstep with the latest published release — but
 * note that any *in-flight* release cycle should accept a slightly
 * stale fallback over refusing to install.
 */
const FALLBACK_NEXTION_SOURCE = "^0.5.2";

const REGISTRY_TIMEOUT_MS = 5_000;

/**
 * Resolved semver range the scaffolder should write into the
 * generated project.
 *
 * If the caller passed an explicit range (via `--nextion-source`
 * or the interactive prompt), that wins. Otherwise we hit the npm
 * registry for `@notionx/core`'s `dist-tags.latest` and prefix it
 * with `^` so the generated project picks up compatible updates.
 */
export async function resolveNextionSource(
  override: string | undefined
): Promise<string> {
  if (override !== undefined && override !== "") {
    return override;
  }
  try {
    const version = await fetchLatestCoreVersion();
    if (version) {
      return `^${version}`;
    }
  } catch {
    // Swallow — fall through to the hardcoded fallback below.
  }
  return FALLBACK_NEXTION_SOURCE;
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
