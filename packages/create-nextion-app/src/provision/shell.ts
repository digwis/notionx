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
