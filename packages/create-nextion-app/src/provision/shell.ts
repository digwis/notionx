// packages/create-nextion-app/src/provision/shell.ts
//
// Thin wrapper around child_process for running `wrangler`, `ntn`,
// and one-off `curl` calls. Never logs captured secret values; the
// caller is responsible for keeping secrets out of the command line
// (we pipe via stdin where available).

import { spawn } from "node:child_process";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export async function run(
  cmd: string,
  args: string[],
  opts: {
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    if (opts.stdin !== undefined) {
      child.stdin.write(opts.stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

/** Run a command attached to the user's terminal for browser-login flows. */
export async function runInteractive(
  cmd: string,
  args: string[],
  opts: {
    cwd?: string;
    env?: Record<string, string>;
  } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code, stdout: "", stderr: "" })
    );
  });
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  /** Strings whose occurrences in stderr should be masked. */
  redact?: string[];
}

/** Run a command, throw with masked stderr on non-zero exit, return stdout. */
export async function runOrThrow(
  cmd: string,
  args: string[],
  opts: RunOptions = {}
): Promise<string> {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) {
    let errOut = r.stderr;
    if (opts.redact) {
      for (const s of opts.redact) {
        errOut = errOut.split(s).join("<redacted>");
      }
    }
    throw new Error(`${cmd} ${args.join(" ")} failed (code ${r.code}): ${errOut.trim()}`);
  }
  return r.stdout;
}

/**
 * `runOrThrow` variant for `ntn` — same throw-on-error semantics,
 * but routes through the PTY-aware wrapper (see `runNtn`).
 */
export async function runOrThrowNtn(
  args: string[],
  opts: RunOptions & { pty?: boolean } = {}
): Promise<string> {
  const r = await runNtn(args, opts);
  if (r.code !== 0) {
    let errOut = r.stderr;
    if (opts.redact) {
      for (const s of opts.redact) {
        errOut = errOut.split(s).join("<redacted>");
      }
    }
    throw new Error(
      `ntn ${args.join(" ")} failed (code ${r.code}): ${errOut.trim()}`
    );
  }
  return r.stdout;
}

/**
 * Run the `ntn` CLI.
 *
 * The prebuilt `ntn` binary (v0.16.0) calls libuv's `uv_tty_init`
 * early in its startup. When we spawn it from Node with piped stdio
 * (the default), libuv sees a non-TTY fd and on some macOS versions
 * returns `EINVAL`, which `ntn` then surfaces as
 * "TTY initialization failed: uv_tty_init returned EINVAL". In
 * practice the HTTP calls `ntn api` makes are unaffected — the only
 * symptom is that the *whole process* dies before the request goes
 * out, so the user sees the TTY error and not the actual API error.
 *
 * The fix: on macOS / Linux, prefer to wrap the call in `unbuffer`
 * (ships with the `expect` Homebrew formula and most Linux distro
 * `expect` packages) which allocates a pseudo-TTY and gives `ntn` a
 * real terminal to attach to. `unbuffer` is best-effort: if it isn't
 * on PATH we fall back to a plain spawn, which works on every host
 * where `ntn` doesn't actually need a TTY (the common case).
 *
 * Output semantics: `unbuffer` mirrors the child's stdout / stderr
 * 1:1 (it does not merge them, unlike `script`), so JSON responses
 * stay parseable.
 */
export async function runNtn(
  args: string[],
  opts: RunOptions & { pty?: boolean } = {}
): Promise<RunResult> {
  // Callers that explicitly want to bypass the wrapper (e.g. the
  // cheap `ntn --version` probe) can opt out.
  if (opts.pty === false) {
    return run("ntn", args, opts);
  }
  // Detect `unbuffer` once per process. We use a tiny in-process
  // cache so we don't shell out to `which` on every API call.
  if (runNtn._unbufferPath === undefined) {
    runNtn._unbufferPath = await detectUnbuffer();
  }
  if (runNtn._unbufferPath) {
    // Note: do NOT pass `-p` here. `-p` switches `unbuffer` from
    // pty-mode to pipe-mode, which (a) re-introduces the libuv
    // EINVAL we are working around, and (b) drops the inner exit
    // code (unbuffer always returns 0 in pipe mode). The default
    // pty mode gives `ntn` the TTY it needs *and* propagates the
    // real exit code.
    return run(runNtn._unbufferPath, ["ntn", ...args], opts);
  }
  return run("ntn", args, opts);
}

runNtn._unbufferPath = undefined as string | null | undefined;

async function detectUnbuffer(): Promise<string | null> {
  // macOS Homebrew puts it on /opt/homebrew/bin or /usr/local/bin
  // (Apple Silicon vs Intel). Linux distros install it under
  // /usr/bin. We `which` via a cheap `command -v`-style probe.
  const probes = [
    "/opt/homebrew/bin/unbuffer",
    "/usr/local/bin/unbuffer",
    "/usr/bin/unbuffer",
  ];
  for (const p of probes) {
    if (await pathExists(p)) return p;
  }
  // Fall back to `which` — works on PATH lookups.
  const r = await run("which", ["unbuffer"]);
  if (r.code === 0 && r.stdout.trim()) return r.stdout.trim();
  return null;
}

async function pathExists(p: string): Promise<boolean> {
  const { existsSync } = await import("node:fs");
  return existsSync(p);
}
