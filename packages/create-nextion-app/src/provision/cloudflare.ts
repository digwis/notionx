// packages/create-nextion-app/src/provision/cloudflare.ts
//
// Provisions Cloudflare resources for a freshly-scaffolded project:
//   - D1 database (create or reuse)
//   - KV namespace (create or reuse)
//   - R2 bucket (create or reuse)
//   - Turnstile widget (create, requires CLOUDFLARE_API_TOKEN)
//
// All Cloudflare resources other than Turnstile use the `wrangler` CLI
// in the user's PATH (assumed globally installed — `wrangler login`
// must have been run). Turnstile has no wrangler subcommand and
// `wrangler login`'s OAuth scope does not include
// `Account.Turnstile:Edit`, so we hit the REST API directly with
// `CLOUDFLARE_API_TOKEN`.
//
// Wrangler 4.x removed `--json` from most write-side and several
// read-side subcommands. We only use `--json` where it's still
// supported (currently only `d1 list`); everything else is parsed
// from wrangler's human-readable text output.

import { runOrThrow, run } from "./shell.js";

export interface CloudflareAccount {
  id: string;
  email?: string;
}

export interface D1Result {
  databaseId: string;
  databaseName: string;
  created: boolean;
}

export interface KVResult {
  namespaceId: string;
  title: string;
  created: boolean;
}

export interface R2Result {
  bucketName: string;
  created: boolean;
}

export interface TurnstileResult {
  sitekey: string;
  secret: string;
  domains: string[];
  created: boolean;
}

/**
 * Verify `wrangler` is installed and the user is logged in.
 * Returns the account id, or throws with a friendly hint.
 */
export async function requireWranglerAuth(): Promise<CloudflareAccount> {
  try {
    const out = await runOrThrow("wrangler", ["whoami"], {});
    // wrangler 4.x prints JSON for `whoami` (e.g.
    // `{"account": {"id": "0ba96e28..."}}`). Be tolerant: fall back
    // to the first 32-char hex string if JSON parsing fails.
    try {
      const parsed = JSON.parse(out) as { account?: { id?: string } };
      if (parsed.account?.id) return { id: parsed.account.id };
    } catch {
      /* not JSON */
    }
    const m = out.match(/\b([0-9a-f]{32})\b/);
    if (m) return { id: m[1] };
    if (/not authenticated|wrangler login/i.test(out)) {
      throw new Error(
        "`wrangler` is not logged in. Run `wrangler login` first."
      );
    }
    throw new Error(
      "Could not parse account id from `wrangler whoami`. Run `wrangler login` first."
    );
  } catch (err) {
    if (err instanceof Error && /ENOENT/.test(err.message)) {
      throw new Error(
        "`wrangler` is not on PATH. Install with: npm i -g wrangler@latest"
      );
    }
    if (err instanceof Error && /not authenticated/i.test(err.message)) {
      throw new Error(
        "`wrangler` is not logged in. Run `wrangler login` first."
      );
    }
    throw err;
  }
}

/** Create a D1 database, or reuse an existing one with the same name. */
export async function ensureD1(name: string): Promise<D1Result> {
  // `wrangler d1 list --json` is still supported in 4.x
  const list = await runOrThrow("wrangler", ["d1", "list", "--json"], {});
  const items = parseJsonArray(list) as Array<{ name?: string; uuid?: string }>;
  const existing = items.find((d) => d.name === name);
  if (existing && existing.uuid) {
    return {
      databaseId: existing.uuid,
      databaseName: name,
      created: false,
    };
  }
  // `wrangler d1 create` does NOT support --json in 4.x. The output
  // looks like:
  //   ✅ Successfully created DB '<name>' in region WNAM
  //   ...
  //   database_id = "7d796b58-16ee-49e8-8bb8-737ea1413bb2"
  const out = await runOrThrow("wrangler", ["d1", "create", name], {});
  const databaseId = parseAssignment(out, "database_id");
  if (!databaseId) {
    throw new Error(
      `Could not parse D1 database_id from wrangler output:\n${out}`
    );
  }
  return { databaseId, databaseName: name, created: true };
}

/** Create a KV namespace, or reuse an existing one with the same title. */
export async function ensureKV(title: string): Promise<KVResult> {
  // `wrangler kv namespace list` in 4.x outputs a JSON array by
  // default (no --json flag needed, but it would be ignored).
  // Example: [{ "id": "...", "title": "CONTENT_CACHE", ... }, ...]
  const list = await runOrThrow(
    "wrangler",
    ["kv", "namespace", "list"],
    {}
  );
  const items = parseJsonArray(list) as Array<{ title?: string; id?: string }>;
  const existing = items.find((n) => n.title === title);
  if (existing && existing.id) {
    return {
      namespaceId: existing.id,
      title,
      created: false,
    };
  }
  // `wrangler kv namespace create` does NOT support --json. Output:
  //   ...
  //   ✨ Success!
  //   ...
  //   id = "bd8afe71e62f4b04b5695f76cd4d3afd"
  const out = await runOrThrow(
    "wrangler",
    ["kv", "namespace", "create", title],
    {}
  );
  const namespaceId = parseAssignment(out, "id");
  if (!namespaceId) {
    throw new Error(`Could not parse KV id from wrangler output:\n${out}`);
  }
  return { namespaceId, title, created: true };
}

/** Create an R2 bucket, or reuse an existing one with the same name. */
export async function ensureR2(bucketName: string): Promise<R2Result> {
  // `wrangler r2 bucket list` does NOT support --json. Output:
  //   name:           digwis-assets
  //   creation_date:  2026-06-11T08:03:22.074Z
  const list = await runOrThrow("wrangler", ["r2", "bucket", "list"], {});
  const existing = parseR2ListOutput(list);
  if (existing.includes(bucketName)) {
    return { bucketName, created: false };
  }
  // `wrangler r2 bucket create <name>` — no --json, but it is
  // idempotent: a fresh bucket prints "✅ Created bucket '...'";
  // an existing one errors out, which is what we expect to skip
  // because we already checked `list` above.
  await runOrThrow(
    "wrangler",
    ["r2", "bucket", "create", bucketName],
    {}
  );
  return { bucketName, created: true };
}

/**
 * Create a Turnstile widget. Requires `CLOUDFLARE_API_TOKEN` in env
 * with `Account.Turnstile:Edit` scope. If the token is missing,
 * returns `null` — the caller will fall back to a manual prompt.
 */
export async function ensureTurnstile(
  accountId: string,
  name: string,
  domains: string[]
): Promise<TurnstileResult | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return null;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/turnstile/widgets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mode: "managed",
        domains,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Cloudflare Turnstile API error (${res.status}): ${body}`
    );
  }
  const json = (await res.json()) as {
    success: boolean;
    result?: { sitekey?: string; secret?: string; domains?: string[] };
    errors?: unknown;
  };
  if (!json.success || !json.result?.sitekey || !json.result?.secret) {
    throw new Error(
      `Cloudflare Turnstile API did not return a widget: ${JSON.stringify(
        json.errors ?? json
      )}`
    );
  }
  return {
    sitekey: json.result.sitekey,
    secret: json.result.secret,
    domains: json.result.domains ?? domains,
    created: true,
  };
}

/**
 * Set a Cloudflare Worker secret via `wrangler secret put` (pipes via
 * stdin so the value never appears on the command line or in shell
 * history).
 */
export async function setWorkerSecret(
  name: string,
  value: string,
  cwd: string,
  redact: string[] = []
): Promise<void> {
  await runOrThrow(
    "wrangler",
    ["secret", "put", name],
    { cwd, stdin: value, redact: [value, ...redact] }
  );
}

// ---------- helpers ----------

/** Strip ANSI color codes (and OSC escape sequences) from a string. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "").replace(/\x1B\][^\x07]*\x07/g, "");
}

/**
 * Parse `key = "value"` (Toml) or `"key": "value"` (JSON) assignments
 * out of wrangler output. Used by `d1 create` and `kv namespace
 * create` to extract `database_id` / `id` from the printed config
 * snippet.
 */
function parseAssignment(text: string, key: string): string | null {
  const clean = stripAnsi(text);
  // Escape any regex metachars in the key (e.g. underscores).
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 1) TOML:  key = "value"   or   key = 'value'  or  key = bare
  // 2) JSON:  "key": "value"  or  "key": 'value'  or  "key": bare
  const patterns = [
    new RegExp(`${esc}\\s*=\\s*"([^"]+)"`, "i"),
    new RegExp(`${esc}\\s*=\\s*'([^']+)'`, "i"),
    new RegExp(`${esc}\\s*=\\s*([A-Za-z0-9-]+)`, "i"),
    new RegExp(`"${esc}"\\s*:\\s*"([^"]+)"`, "i"),
    new RegExp(`"${esc}"\\s*:\\s*'([^']+)'`, "i"),
    new RegExp(`"${esc}"\\s*:\\s*([A-Za-z0-9-]+)`, "i"),
  ];
  for (const re of patterns) {
    const m = clean.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Parse `wrangler r2 bucket list` text output → list of bucket names. */
function parseR2ListOutput(text: string): string[] {
  const clean = stripAnsi(text);
  const names: string[] = [];
  for (const line of clean.split(/\r?\n/)) {
    const m = line.match(/^name:\s+(.+)$/);
    if (m) names.push(m[1].trim());
  }
  return names;
}

function parseJsonArray(text: string): unknown[] {
  const clean = stripAnsi(text);
  // wrangler prints either a bare JSON array or a JSON line inside a table.
  // Try strict parse first, then scan for the first `[...]` block.
  try {
    const v = JSON.parse(clean);
    return Array.isArray(v) ? v : [];
  } catch {
    /* fall through */
  }
  const m = clean.match(/\[[\s\S]*?\]/);
  if (!m) return [];
  try {
    const v = JSON.parse(m[0]);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
