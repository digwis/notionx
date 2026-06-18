// packages/notionx-cli/src/provision/ntn-credentials.ts
//
// Resolve a Notion API token from the `ntn` CLI's local credentials,
// so the scaffolder can skip the "paste your token" step for users
// who have already done `ntn login`.
//
// Where `ntn` stores its token:
//
//   - macOS:      Keychain (service "notion-cli"). We read it with
//                 `security find-generic-password -s notion-cli -w`.
//                 The user may be prompted by macOS to allow the
//                 first read in a session, but subsequent reads are
//                 silent.
//   - Linux:      GNOME Keyring / KWallet via `secret-tool`. The
//                 attribute pair is `service notion-cli`. We try
//                 `secret-tool` first and fall back to
//                 `~/.config/notion/auth.json`.
//   - Windows:    Credential Manager (`cmdkey /list`). We do not
//                 implement Windows keychain reads here — the
//                 file-based fallback applies when the user has set
//                 `NOTION_KEYRING=0`.
//   - File mode:  When the user has exported `NOTION_KEYRING=0`
//                 before running `ntn login`, ntn writes a JSON file
//                 to `~/.config/notion/auth.json` containing the
//                 active workspace's token. We read that.
//
// All three return paths are best-effort: if the local credential
// store does not contain a Notion token (or we cannot read it), the
// caller falls back to the manual `secret_…` paste prompt.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { run, runNtn } from "./shell.js";

export interface NtnCredential {
  token: string;
  /** Where the token came from. Surfaced in the scaffolder logs. */
  source:
    | "ntn-macos-keychain"
    | "ntn-linux-keyring"
    | "ntn-auth-json"
    | "ntn-env";
  /** Workspace name (if known) for nicer status output. */
  workspace?: string;
}

const KEYCHAIN_SERVICE = "notion-cli";

/**
 * Try every well-known location in turn. Returns the first token that
 * verifies as a live Notion API token, or `null` if nothing usable
 * was found.
 */
export async function readNtnToken(): Promise<NtnCredential | null> {
  // 0. Honor an explicit env override first. (This is the path
  // `ntn` itself uses internally.)
  if (process.env.NOTION_API_TOKEN && process.env.NOTION_API_TOKEN.length > 0) {
    return { token: process.env.NOTION_API_TOKEN, source: "ntn-env" };
  }

  // 1. Try the platform-native credential store.
  const native = await readFromNativeStore();
  if (native) return native;

  // 2. Fall back to the file-based store ntn uses when the user has
  //    disabled the keyring via `NOTION_KEYRING=0`.
  const fileBased = await readFromAuthJson();
  if (fileBased) return fileBased;

  return null;
}

async function readFromNativeStore(): Promise<NtnCredential | null> {
  const p = platform();
  if (p === "darwin") {
    return readFromMacosKeychain();
  }
  if (p === "linux") {
    return readFromLinuxKeyring();
  }
  // Windows: skip native store — not implemented.
  return null;
}

async function readFromMacosKeychain(): Promise<NtnCredential | null> {
  const r = await run("security", [
    "find-generic-password",
    "-s",
    KEYCHAIN_SERVICE,
    "-w",
  ]);
  if (r.code !== 0) return null;
  const token = r.stdout.trim();
  if (!token) return null;
  // `ntn` stores its token in the account field as a UUID-like value,
  // not in the password field. Some installations put it in the
  // password — cover both.
  if (looksLikeNotionToken(token)) {
    return { token, source: "ntn-macos-keychain" };
  }
  const accountR = await run("security", [
    "find-generic-password",
    "-s",
    KEYCHAIN_SERVICE,
    "-g",
  ]);
  const accountMatch = accountR.stdout.match(/"acct"<blob>="([^"]+)"/);
  const account = accountMatch?.[1]?.trim();
  if (account && looksLikeNotionToken(account)) {
    return { token: account, source: "ntn-macos-keychain" };
  }
  return null;
}

async function readFromLinuxKeyring(): Promise<NtnCredential | null> {
  // `secret-tool` is the standard D-Bus Secret Service client on
  // GNOME. It prompts the user the first time per session.
  const r = await run("secret-tool", [
    "lookup",
    "service",
    KEYCHAIN_SERVICE,
  ]);
  if (r.code !== 0 || !r.stdout.trim()) return null;
  const token = r.stdout.trim();
  if (!looksLikeNotionToken(token)) return null;
  return { token, source: "ntn-linux-keyring" };
}

interface AuthJsonShape {
  version?: string;
  workspaces?: Record<
    string,
    Record<
      string,
      { token?: string; name?: string; active?: boolean }
    >
  >;
  defaultWorkspaceId?: string;
  defaultWorkspaceIds?: Record<string, string>;
  // Some ntn versions use a flatter schema.
  token?: string;
}

async function readFromAuthJson(): Promise<NtnCredential | null> {
  const file = join(homedir(), ".config", "notion", "auth.json");
  if (!existsSync(file)) return null;
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  let parsed: AuthJsonShape;
  try {
    parsed = JSON.parse(raw) as AuthJsonShape;
  } catch {
    return null;
  }

  // Flat schema: `{ "token": "ntn_…" }`
  if (parsed.token && looksLikeNotionToken(parsed.token)) {
    return { token: parsed.token, source: "ntn-auth-json" };
  }

  // Nested schema: `{ workspaces: { prod: { <id>: { token, name } } } }`
  if (parsed.workspaces) {
    for (const [envKey, wsMap] of Object.entries(parsed.workspaces)) {
      if (!wsMap) continue;
      // Prefer the default workspace id, fall back to the first
      // entry that has a token.
      const preferredId =
        parsed.defaultWorkspaceIds?.[envKey] ??
        parsed.defaultWorkspaceId ??
        Object.keys(wsMap)[0];
      const ordered = [
        wsMap[preferredId],
        ...Object.entries(wsMap)
          .filter(([id]) => id !== preferredId)
          .map(([, v]) => v),
      ];
      for (const entry of ordered) {
        if (entry?.token && looksLikeNotionToken(entry.token)) {
          return {
            token: entry.token,
            source: "ntn-auth-json",
            workspace: entry.name,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Best-effort: ask the `ntn` CLI to confirm that *some* credentials
 * are present. We use this to give a clear "Run `ntn login` first"
 * hint when we fail to read the token directly.
 */
export async function isNtnLoggedIn(): Promise<boolean> {
  // `ntn whoami` is read-only but still calls libuv's
  // `uv_tty_init` on startup, so we keep the PTY-aware wrapper for
  // it to actually exit 0 on hosts where the libuv TTY dance is
  // strict.
  const r = await runNtn(["whoami"]);
  return r.code === 0;
}

function looksLikeNotionToken(s: string): boolean {
  // Notion integration tokens start with "secret_", "ntn_", or
  // (for OAuth public integrations) a UUID-like bearer. The CLI
  // stores its own OAuth token, so ntn_… is the common shape.
  return /^(secret_[A-Za-z0-9]{20,}|ntn_[A-Za-z0-9]{20,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})$/.test(
    s
  );
}

/** Human-friendly source label for the status card. */
export function describeNtnSource(source: NtnCredential["source"]): string {
  switch (source) {
    case "ntn-macos-keychain":
      return "macOS Keychain (service=notion-cli)";
    case "ntn-linux-keyring":
      return "Linux Secret Service (service=notion-cli)";
    case "ntn-auth-json":
      return "~/.config/notion/auth.json";
    case "ntn-env":
      return "NOTION_API_TOKEN env var";
  }
}
