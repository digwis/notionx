// packages/create-nextion-app/src/provision/wire.ts
//
// Patches the freshly-rendered project with real resource ids and
// secrets. Operates on `wrangler.jsonc` (JSONC — uses a small tolerant
// parser to preserve comments and formatting) and `.dev.vars` (KEY=VALUE).
//
// Idempotent: running it twice is safe (it overwrites existing keys
// with the same value, and leaves other lines untouched).

import { promises as fs } from "node:fs";
import path from "node:path";

export interface WireInputs {
  d1DatabaseId: string;
  kvNamespaceId: string;
  /** vinext@0.1.1 ISR data cache KV (`VINEXT_KV_CACHE` binding). */
  vinextKvNamespaceId: string;
  /** Optional Turnstile values. */
  turnstileSitekey?: string;
  turnstileSecret?: string;
  /** Optional Notion values. */
  notionToken?: string;
  notionDataSourceId?: string;
  /** Optional pages data source id (NOTION_PAGES_DATA_SOURCE_ID). */
  notionPagesDataSourceId?: string;
  /** Optional site-settings data source id (NOTION_SITE_SETTINGS_DATA_SOURCE_ID). */
  notionSiteSettingsDataSourceId?: string;
  /** Optional Resend values. */
  resendApiKey?: string;
  resendFrom?: string;
  /** Optional Google OAuth values. */
  googleClientId?: string;
  googleClientSecret?: string;
}

/** Patch `wrangler.jsonc` — replace placeholder ids with real ones. */
export async function patchWranglerJsonc(
  projectDir: string,
  inputs: WireInputs
): Promise<void> {
  const file = path.join(projectDir, "wrangler.jsonc");
  const raw = await fs.readFile(file, "utf8");
  let patched = raw
    .replace(/REPLACE_WITH_D1_DATABASE_ID/g, inputs.d1DatabaseId)
    .replace(/REPLACE_WITH_KV_NAMESPACE_ID/g, inputs.kvNamespaceId)
    .replace(/REPLACE_WITH_VINEXT_KV_NAMESPACE_ID/g, inputs.vinextKvNamespaceId);
  if (inputs.notionSiteSettingsDataSourceId) {
    patched = patched.replace(
      /REPLACE_WITH_NOTION_SITE_SETTINGS_DATA_SOURCE_ID/g,
      inputs.notionSiteSettingsDataSourceId
    );
  }
  await fs.writeFile(file, patched, "utf8");
}

/** Patch the deployed worker URL back into `vars.SITE_URL`. */
export async function patchSiteUrl(
  projectDir: string,
  siteUrl: string
): Promise<void> {
  const file = path.join(projectDir, "wrangler.jsonc");
  const raw = await fs.readFile(file, "utf8");
  const patched = raw.replace(
    /"SITE_URL"\s*:\s*"[^"]*"/,
    `"SITE_URL": "${siteUrl}"`
  );
  await fs.writeFile(file, patched, "utf8");
}

/**
 * Write `.dev.vars` from `.dev.vars.example`, replacing placeholders
 * and appending/updating optional keys. Other lines are preserved.
 */
export async function writeDevVars(
  projectDir: string,
  inputs: WireInputs
): Promise<void> {
  const examplePath = path.join(projectDir, ".dev.vars.example");
  const devVarsPath = path.join(projectDir, ".dev.vars");
  const raw = await fs.readFile(examplePath, "utf8");

  const updates: Record<string, string> = {
    D1_DATABASE_ID: inputs.d1DatabaseId,
    KV_NAMESPACE_ID: inputs.kvNamespaceId,
    TURNSTILE_SITE_KEY: inputs.turnstileSitekey ?? "",
    TURNSTILE_SECRET_KEY: inputs.turnstileSecret ?? "",
    NOTION_TOKEN: inputs.notionToken ?? "",
    NOTION_DATA_SOURCE_ID: inputs.notionDataSourceId ?? "",
    NOTION_PAGES_DATA_SOURCE_ID: inputs.notionPagesDataSourceId ?? "",
    NOTION_SITE_SETTINGS_DATA_SOURCE_ID:
      inputs.notionSiteSettingsDataSourceId ?? "",
    RESEND_API_KEY: inputs.resendApiKey ?? "",
    RESEND_FROM: inputs.resendFrom ?? "",
    GOOGLE_CLIENT_ID: inputs.googleClientId ?? "",
    GOOGLE_CLIENT_SECRET: inputs.googleClientSecret ?? "",
  };

  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)\s*=/);
    if (m && m[1] in updates) {
      const key = m[1];
      out.push(`${key}=${updates[key]}`);
      seen.add(key);
    } else {
      out.push(line);
    }
  }
  // Append any keys not present in the example file.
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k) && v) out.push(`${k}=${v}`);
  }
  await fs.writeFile(devVarsPath, out.join("\n"), { mode: 0o600 });
}
