// packages/create-nextion-app/src/provision/index.ts
//
// Orchestrates the post-render provisioning flow:
//   1. Verify wrangler auth (required)
//   2. Create / reuse D1, KV, R2 (idempotent)
//   3. Wire real bindings, then create D1 tables locally via
//      `d1 migrations apply --local`
//   4. Turnstile, Resend, and Google OAuth are intentionally
//      skipped here — users wire them up manually after scaffold.
//   5. Create Notion data source if `NOTION_API_TOKEN` is set,
//      otherwise prompt (interactive mode only)
//   6. Wire everything into `wrangler.jsonc` + `.dev.vars` +
//      `wrangler secret put` for secrets
//   7. Print a status card with ✅ / ⚠️ per item + repair commands
//
// Every step is best-effort and degrades gracefully. The scaffolded
// project is usable even if all optional steps are skipped — the user
// can re-run individual commands from the printed status card.

import * as p from "@clack/prompts";
import type { Answers } from "../prompt.js";
import { runOrThrow, run, runInteractive } from "./shell.js";
import { defaultProvisionMode, type ProvisionMode } from "./options.js";
import {
  type CloudflareAccount,
  requireWranglerAuth,
  ensureD1,
  ensureKV,
  ensureR2,
  setWorkerSecret,
} from "./cloudflare.js";
import {
  isNtnAvailable,
  verifyNotionToken,
  ensureNotionDatabase,
  ensurePagesDatabase,
} from "./notion.js";
import { promptNotion } from "./prompts.js";
import {
  patchSiteUrl,
  patchWranglerJsonc,
  writeDevVars,
  type WireInputs,
} from "./wire.js";
import { ensureDependencies } from "./dependencies.js";
import {
  readNtnToken,
  isNtnLoggedIn,
  describeNtnSource,
  type NtnCredential,
} from "./ntn-credentials.js";

export interface ProvisionResult {
  d1: { ok: boolean; id?: string; message?: string; created?: boolean };
  kv: { ok: boolean; id?: string; message?: string; created?: boolean };
  /** vinext@0.1.1 ISR data cache KV (binding `VINEXT_KV_CACHE`). */
  vinextKv: { ok: boolean; id?: string; message?: string; created?: boolean };
  r2: { ok: boolean; name?: string; message?: string; created?: boolean };
  turnstile: {
    ok: boolean;
    sitekey?: string;
    secret?: string;
    message?: string;
    skipped?: boolean;
  };
  notion: {
    ok: boolean;
    dataSourceId?: string;
    pagesDataSourceId?: string;
    message?: string;
    skipped?: boolean;
    seeded?: number;
    pagesSeeded?: number;
  };
  resend: { ok: boolean; enabled: boolean; message?: string };
  google: { ok: boolean; enabled: boolean; message?: string };
  migrationsApplied: boolean;
  deploy: {
    ok: boolean;
    url?: string;
    workerName?: string;
    message?: string;
    skipped?: boolean;
  };
  admin: { ok: boolean; email: string; message?: string };
  // Internal carriers for the wire step — never printed in the
  // status card.
  _turnstileSecret?: string;
  _notionToken?: string;
}

export async function provision(
  answers: Answers,
  projectDir: string,
  options: { interactive: boolean; mode?: ProvisionMode }
): Promise<ProvisionResult> {
  const mode = options.mode ?? defaultProvisionMode("create");
  const result: ProvisionResult = {
    d1: { ok: false },
    kv: { ok: false },
    vinextKv: { ok: false },
    r2: { ok: false },
    turnstile: { ok: false },
    notion: { ok: false },
    resend: { ok: false, enabled: false },
    google: { ok: false, enabled: false },
    migrationsApplied: false,
    deploy: { ok: false, skipped: true },
    admin: {
      ok: true,
      email: answers.adminEmail,
      message: "seed migration generated",
    },
  };

  // The project uses kebab-case for resource names.
  const slug = answers.projectName.toLowerCase();
  const d1Name = `${slug}-db`;
  const r2Name = `${slug}-assets`;

  // ---- 0. External CLI tools (wrangler, ntn) ----
  // Make sure wrangler/ntn are on PATH at a usable version before we
  // try to drive them. Missing tools get installed (with a prompt in
  // interactive mode).
  const deps = await ensureDependencies(undefined, {
    interactive: options.interactive,
  });
  for (const dep of deps) {
    if (!dep.available) {
      p.log.warn(
        `${dep.name}: unavailable — related steps will be skipped.`
      );
    } else if (dep.needsUpgrade) {
      p.log.warn(
        `${dep.name} ${dep.version} is older than required ${dep.minVersion} — some steps may fail.`
      );
    } else if (dep.installedNow) {
      p.log.success(
        `${dep.name} ${dep.version ?? ""} ready${dep.installedNow ? " (just installed)" : ""}.`
      );
    } else if (dep.version) {
      p.log.success(`${dep.name} ${dep.version} ready.`);
    }
  }

  // ---- 1. Wrangler auth ----
  try {
    const acc = await requireWranglerAuthWithOptionalLogin(options.interactive);
    p.log.success(`Cloudflare: logged in (account ${acc.id.slice(0, 8)}…)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(`Cloudflare: ${message}`);
    p.log.info(
      "Re-run after `wrangler login`. You can still use the project; just create D1/KV/R2 by hand."
    );
    result.turnstile = {
      ok: false,
      skipped: true,
      message: "skipped until Cloudflare login",
    };
    result.notion = {
      ok: false,
      skipped: true,
      message: "skipped because Cloudflare provisioning did not start",
    };
    return finalize(result, projectDir, slug);
  }

  // ---- 2-3. D1 / KV / R2 ----
  try {
    const r = await ensureD1(d1Name);
    result.d1 = { ok: true, id: r.databaseId, created: r.created };
    p.log.success(
      `D1: ${r.created ? "created" : "reused"} ${d1Name} (${r.databaseId.slice(0, 8)}…)`
    );
  } catch (err) {
    result.d1 = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    p.log.error(`D1: ${result.d1.message}`);
  }

  try {
    const r = await ensureKV("CONTENT_CACHE");
    result.kv = { ok: true, id: r.namespaceId, created: r.created };
    p.log.success(
      `KV: ${r.created ? "created" : "reused"} CONTENT_CACHE (${r.namespaceId.slice(0, 8)}…)`
    );
  } catch (err) {
    result.kv = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    p.log.error(`KV: ${result.kv.message}`);
  }

  // Second KV namespace: vinext@0.1.1's deploy check requires a
  // `VINEXT_KV_CACHE` binding whenever a route uses ISR / `revalidate`.
  // Skipping this would surface a hard deploy-time error from
  // `vinext deploy` even though `pnpm install` would have succeeded.
  try {
    const r = await ensureKV("VINEXT_KV_CACHE");
    result.vinextKv = { ok: true, id: r.namespaceId, created: r.created };
    p.log.success(
      `KV: ${r.created ? "created" : "reused"} VINEXT_KV_CACHE (${r.namespaceId.slice(0, 8)}…)`
    );
  } catch (err) {
    result.vinextKv = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    p.log.error(`KV (vinext cache): ${result.vinextKv.message}`);
  }

  try {
    const r = await ensureR2(r2Name);
    result.r2 = { ok: true, name: r.bucketName, created: r.created };
    p.log.success(
      `R2: ${r.created ? "created" : "reused"} ${r2Name}`
    );
  } catch (err) {
    result.r2 = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    p.log.error(`R2: ${result.r2.message}`);
  }

  // ---- 4. Turnstile ----
  // Skipped silently during scaffolding. The generated project still
  // ships with full Turnstile support — an unset secret is a no-op
  // in the auth flow. Users can wire the widget manually later (see
  // README) or set CLOUDFLARE_API_TOKEN and re-run the relevant
  // helper. No log, no prompt, no auto-create here.
  result.turnstile = {
    ok: false,
    skipped: true,
    message: "skipped during scaffolding (configure manually later)",
  };

  // ---- 5. Notion ----
  // Token resolution order:
  //   1. `NOTION_API_TOKEN` env var (explicit, highest priority)
  //   2. `ntn` CLI's local credentials (keychain / auth.json)
  //   3. Interactive `secret_…` paste (only when interactive and no
  //      auto-source found)
  // Regardless of source, we still need a parent page id, which we
  // always prompt for interactively.
  try {
    const envToken = process.env.NOTION_API_TOKEN?.trim();
    let autoToken: NtnCredential | null = null;
    let resolvedToken: string | null = envToken || null;

    if (!resolvedToken) {
      autoToken = await readNtnToken();
      if (autoToken) {
        resolvedToken = autoToken.token;
        p.log.success(
          `Notion: auto-detected credentials (${describeNtnSource(autoToken.source)})`
        );
      } else {
        // Give a useful hint about the fastest path forward.
        const ntnLoggedIn = await isNtnLoggedIn();
        if (!ntnLoggedIn) {
          p.log.info(
            "Notion: no credentials detected. Run `ntn login` once to skip the token prompt, or paste a `secret_…` token below."
          );
          autoToken = await promptNtnLogin(options.interactive);
          if (autoToken) {
            resolvedToken = autoToken.token;
            p.log.success(
              `Notion: auto-detected credentials (${describeNtnSource(autoToken.source)})`
            );
          }
        }
      }
    }

    if (resolvedToken) {
      const ok = await verifyNotionToken(resolvedToken);
      if (!ok) throw new Error("Notion token failed verification");
      const ntn = await isNtnAvailable();
      if (!ntn) {
        throw new Error("`ntn` CLI not installed. Run: npm i -g ntn@latest");
      }
      // Resolution order for parent page + seed count:
      //   1. `answers.notionParentPage` (--notion-parent-page flag)
      //   2. Interactive prompt (only when stdin is a TTY)
      //   3. Skip silently
      let notionInputs: { apiToken: string; parentPageId: string; seedCount: number } | null = null;
      if (answers.notionParentPage) {
        notionInputs = {
          apiToken: resolvedToken,
          parentPageId: answers.notionParentPage,
          seedCount: answers.notionSeedCount,
        };
      } else {
        notionInputs = await promptNotion(
          { interactive: options.interactive },
          answers.contentSource.fields,
          resolvedToken,
          answers.notionSeedCount
        );
      }
      if (notionInputs) {
        const { content, pages } = await provisionNotionContentAndPages({
          answers,
          apiToken: notionInputs.apiToken,
          parentPageId: notionInputs.parentPageId,
          seedCount: notionInputs.seedCount,
        });
        result.notion = {
          ok: true,
          dataSourceId: content.dataSourceId,
          pagesDataSourceId: pages.dataSourceId,
          seeded: content.seeded,
          pagesSeeded: pages.seeded,
          ...(autoToken
            ? { message: `token from ${describeNtnSource(autoToken.source)}` }
            : {}),
        };
        p.log.success(
          `Notion: content data source ${content.dataSourceId.slice(0, 8)}… seeded ${content.seeded}; Pages ${pages.dataSourceId.slice(0, 8)}… seeded ${pages.seeded}.`
        );
        result._notionToken = resolvedToken;
      } else {
        result.notion = {
          ok: false,
          skipped: true,
          message: "Notion: token present but no parent page provided.",
        };
        p.log.warn("Notion: skipped (no parent page id).");
      }
    } else {
      // No env, no auto-detected ntn credentials. Fall back to the
      // interactive paste prompt.
      const notion = await promptNotion(
        { interactive: options.interactive },
        answers.contentSource.fields,
        undefined,
        answers.notionSeedCount
      );
      if (notion) {
        const { content, pages } = await provisionNotionContentAndPages({
          answers,
          apiToken: notion.apiToken,
          parentPageId: notion.parentPageId,
          seedCount: notion.seedCount,
        });
        result.notion = {
          ok: true,
          dataSourceId: content.dataSourceId,
          pagesDataSourceId: pages.dataSourceId,
          seeded: content.seeded,
          pagesSeeded: pages.seeded,
        };
        p.log.success(
          `Notion: content data source ${content.dataSourceId.slice(0, 8)}… seeded ${content.seeded}; Pages ${pages.dataSourceId.slice(0, 8)}… seeded ${pages.seeded}.`
        );
        result._notionToken = notion.apiToken;
      } else {
        result.notion = {
          ok: false,
          skipped: true,
          message:
            "Notion: set NOTION_API_TOKEN (and rerun), or run `ntn login` once to skip the prompt.",
        };
        p.log.warn("Notion: skipped.");
      }
    }
  } catch (err) {
    result.notion = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
    p.log.error(`Notion: ${result.notion.message}`);
  }

  // ---- 6. Optional Resend + Google ----
  // Skipped during scaffolding — no prompt, no auto-create. Users
  // wire these up manually after the project is generated (see the
  // project README). Result rows are still surfaced in the status
  // card so the operator knows the integration is intentionally
  // disabled.
  result.resend = { ok: true, enabled: false, message: "skipped (configure manually later)" };
  result.google = { ok: true, enabled: false, message: "skipped (configure manually later)" };

  // ---- 7. Wire everything into wrangler.jsonc + .dev.vars ----
  let wireInputs: WireInputs | null = null;
  if (result.d1.ok && result.kv.ok && result.vinextKv.ok) {
    wireInputs = {
      d1DatabaseId: result.d1.id!,
      kvNamespaceId: result.kv.id!,
      vinextKvNamespaceId: result.vinextKv.id!,
      turnstileSitekey: result.turnstile.sitekey,
      turnstileSecret: result.turnstile.ok ? result.turnstile.secret : undefined,
      notionToken: result._notionToken,
      notionDataSourceId: result.notion.dataSourceId,
      notionPagesDataSourceId: result.notion.pagesDataSourceId,
    };
    try {
      await patchWranglerJsonc(projectDir, wireInputs);
      await writeDevVars(projectDir, wireInputs);
      p.log.success(`Wired: wrangler.jsonc + .dev.vars updated.`);
      if (result.d1.ok && result.d1.id) {
        try {
          await runOrThrow(
            "wrangler",
            ["d1", "migrations", "apply", d1Name, "--local"],
            { cwd: projectDir }
          );
          result.migrationsApplied = true;
          p.log.success(`D1 migrations: applied to local store`);
          await runOrThrow(
            "wrangler",
            [
              "d1",
              "execute",
              d1Name,
              "--local",
              "--file",
              "migrations/0002_admin_seed.sql",
            ],
            { cwd: projectDir }
          );
          p.log.success(`D1 admin seed: refreshed locally`);
        } catch (migrationErr) {
          const msg =
            migrationErr instanceof Error
              ? migrationErr.message
              : String(migrationErr);
          p.log.warn(`D1 migrations: ${msg}`);
        }
      }
    } catch (err) {
      p.log.error(
        `Wiring failed: ${err instanceof Error ? err.message : err}`
      );
    }

  }

  // ---- 6. Admin account ----
  // The admin user is seeded by `migrations/0002_admin_seed.sql`,
  // which we hash-rendered at template time. The migration runs as
  // part of step 3 (D1 migrations apply), so all we do here is mark
  // the row "ok" and surface the email in the status card. If
  // migrations were not applied (e.g. wrangler missing), we still
  // treat this as ok — the SQL is on disk and will run on the user's
  // first `wrangler d1 migrations apply` after `pnpm install`.
  result.admin = {
    ok: true,
    email: answers.adminEmail,
    message: "seed refreshed via 0002_admin_seed.sql",
  };

  if (!mode.deploy) {
    result.deploy = {
      ok: false,
      workerName: slug,
      skipped: true,
      message: "deploy disabled for this provisioning mode",
    };
    return finalize(result, projectDir, slug);
  }

  // ---- 7. Deploy ----
  // Goal: one scaffolder command = a live `https://<name>.<subdomain>.workers.dev`
  // URL the user can visit. Steps in order:
  //   a. `pnpm install` — produces node_modules + the worker bundle
  //      that wrangler can upload. Skip on failure (caller will need
  //      to run it manually anyway).
  //   b. `wrangler d1 migrations apply <db> --remote` — pushes
  //      0001_init.sql + 0002_admin_seed.sql to the live D1 database
  //      we just created. Without this, the deployed worker has no
  //      schema and the admin user cannot log in.
  //   c. `vinext deploy` — the project's own deploy command. It
  //      builds the bundle and calls `wrangler deploy` under the
  //      hood. We capture stdout to find the workers.dev URL.
  // If any step fails, we don't try the next one — surface a hint
  // in the status card so the user can run them by hand.
  try {
    const install = await run("pnpm", ["install", "--prefer-offline"], {
      cwd: projectDir,
    });
    if (install.code !== 0) {
      throw new Error(
        `pnpm install failed (exit ${install.code}); run it manually inside ${projectDir}`
      );
    }
    p.log.success("pnpm install: done.");

    const d1Id = result.d1.id;
    if (!d1Id) throw new Error("no D1 id available; cannot apply migrations");
    const migrate = await run(
      "pnpm",
      ["exec", "wrangler", "d1", "migrations", "apply", d1Name, "--remote"],
      { cwd: projectDir }
    );
    if (migrate.code !== 0) {
      const tail = (migrate.stderr || migrate.stdout).trim().split("\n").slice(-6).join("\n");
      throw new Error(
        `wrangler d1 migrations apply --remote failed (exit ${migrate.code}):\n${tail}`
      );
    }
    p.log.success("D1 migrations: applied to remote.");

    const remoteAdminSeed = await run(
      "pnpm",
      [
        "exec",
        "wrangler",
        "d1",
        "execute",
        d1Name,
        "--remote",
        "--file",
        "migrations/0002_admin_seed.sql",
      ],
      { cwd: projectDir }
    );
    if (remoteAdminSeed.code !== 0) {
      const tail = (remoteAdminSeed.stderr || remoteAdminSeed.stdout)
        .trim()
        .split("\n")
        .slice(-6)
        .join("\n");
      throw new Error(
        `wrangler d1 execute admin seed --remote failed (exit ${remoteAdminSeed.code}):\n${tail}`
      );
    }
    p.log.success("D1 admin seed: refreshed on remote.");

    const deploy = await run("pnpm", ["exec", "vinext", "deploy"], {
      cwd: projectDir,
    });
    if (deploy.code !== 0) {
      const tail = (deploy.stderr || deploy.stdout).trim().split("\n").slice(-8).join("\n");
      throw new Error(`vinext deploy failed (exit ${deploy.code}):\n${tail}`);
    }
    const firstDeployUrl = parseWorkerUrl(deploy.stdout + "\n" + deploy.stderr);
    const secretsChanged = await setProvisionedWorkerSecrets({
      projectDir,
      wireInputs,
      requireNotionSecrets: result.notion.ok,
    });

    let finalUrl = firstDeployUrl;
    if (firstDeployUrl) {
      await patchSiteUrl(projectDir, firstDeployUrl);
      p.log.success(`SITE_URL: ${firstDeployUrl}`);
    }

    if (firstDeployUrl || secretsChanged) {
      const redeploy = await run("pnpm", ["exec", "vinext", "deploy"], {
        cwd: projectDir,
      });
      if (redeploy.code !== 0) {
        const tail = (redeploy.stderr || redeploy.stdout).trim().split("\n").slice(-8).join("\n");
        throw new Error(`vinext deploy failed after secrets/SITE_URL update (exit ${redeploy.code}):\n${tail}`);
      }
      finalUrl = parseWorkerUrl(redeploy.stdout + "\n" + redeploy.stderr) ?? finalUrl;
    }

    result.deploy = {
      ok: true,
      url: finalUrl,
      workerName: slug,
    };
    p.log.success(
      `Worker deployed: ${finalUrl ?? "(url not detected in output)"}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.deploy = {
      ok: false,
      workerName: slug,
      message,
      skipped: false,
    };
    p.log.warn(
      `Deploy skipped — ${message.split("\n")[0]}\n  (Run \`pnpm exec vinext deploy\` inside ${projectDir} to retry.)`
    );
  }

  return finalize(result, projectDir, slug);
}

async function requireWranglerAuthWithOptionalLogin(
  interactive: boolean
): Promise<CloudflareAccount> {
  try {
    return await requireWranglerAuth();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!interactive || !/wrangler.*not logged in|wrangler login/i.test(message)) {
      throw err;
    }

    const login = await p.confirm({
      message:
        "Cloudflare is not logged in. Run `wrangler login` now and continue provisioning?",
      initialValue: true,
    });
    if (p.isCancel(login) || !login) throw err;

    const loginResult = await runInteractive("wrangler", ["login"]);
    if (loginResult.code !== 0) {
      throw new Error(
        `wrangler login failed (exit ${loginResult.code ?? "unknown"})`
      );
    }
    return requireWranglerAuth();
  }
}

async function promptNtnLogin(
  interactive: boolean
): Promise<NtnCredential | null> {
  if (!interactive) return null;
  const login = await p.confirm({
    message:
      "Notion is not logged in. Run `ntn login` now so the scaffolder can create and seed the content database?",
    initialValue: true,
  });
  if (p.isCancel(login) || !login) return null;

  const start = await run("ntn", ["login", "--no-browser"]);
  if (start.code !== 0) {
    p.log.warn(
      `ntn login --no-browser failed (exit ${start.code ?? "unknown"}).`
    );
    return null;
  }
  const output = start.stdout.trim();
  if (output) {
    console.log("");
    console.log(output);
    console.log("");
  }

  const url = output.match(/https?:\/\/\S+/)?.[0];
  if (url) {
    p.log.info(`Opening Notion login URL in your browser:\n  ${url}`);
    // Best-effort macOS/browser launcher. The URL is printed above so
    // users still have a manual path when `open` is unavailable.
    await run("open", [url]).catch(() => null);
  }

  const poll = await runInteractive("ntn", ["login", "poll"]);
  if (poll.code !== 0) {
    p.log.warn(`ntn login poll failed (exit ${poll.code ?? "unknown"}).`);
    return null;
  }

  const token = await readNtnToken();
  if (token) return token;
  p.log.warn(
    "ntn login finished, but the scaffolder could not read the saved token. You can paste a `secret_…` integration token instead."
  );
  return null;
}

function parseWorkerUrl(text: string): string | undefined {
  // wrangler prints lines like:
  //   Published <name> (X.XX sec)
  //     https://<name>.<subdomain>.workers.dev
  const clean = text.replace(/\u001b\[[0-9;]*m/g, "");
  return clean.match(/https:\/\/[a-zA-Z0-9._-]+\.workers\.dev/)?.[0];
}

async function provisionNotionContentAndPages({
  answers,
  apiToken,
  parentPageId,
  seedCount,
}: {
  answers: Answers;
  apiToken: string;
  parentPageId: string;
  seedCount: number;
}) {
  const content = await ensureNotionDatabase({
    apiToken,
    parentPageId,
    title: `${answers.projectName} ${answers.contentSource.title}`,
    stableKey: `content:${answers.contentSource.id}`,
    locale: answers.defaultLocale,
    fields: answers.contentSource.fields,
    seedCount,
  });

  const pages = await ensurePagesDatabase({
    apiToken,
    parentPageId,
    projectName: answers.projectName,
    contentSourceId: answers.contentSource.id,
    contentSourceTitle: answers.contentSource.title,
    contentSourceListPath: `/${answers.contentSource.id}`,
    locale: answers.defaultLocale,
  });

  return { content, pages };
}

async function setProvisionedWorkerSecrets({
  projectDir,
  wireInputs,
  requireNotionSecrets,
}: {
  projectDir: string;
  wireInputs: WireInputs | null;
  requireNotionSecrets: boolean;
}): Promise<boolean> {
  if (!wireInputs) return false;
  let changed = false;

  const putSecret = async (
    name: string,
    value: string | undefined,
    required: boolean
  ) => {
    if (!value) return;
    try {
      await setWorkerSecret(name, value, projectDir, [value]);
      p.log.success(`Worker secret: ${name} set.`);
      changed = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (required) {
        throw new Error(
          `failed to set ${name}; production content will be empty until this secret is set:\n${message}`
        );
      }
      p.log.info(`Worker secret: ${name} skipped (${message.split("\n")[0]}).`);
    }
  };

  await putSecret("TURNSTILE_SECRET_KEY", wireInputs.turnstileSecret, false);
  await putSecret("NOTION_TOKEN", wireInputs.notionToken, requireNotionSecrets);
  await putSecret(
    "NOTION_DATA_SOURCE_ID",
    wireInputs.notionDataSourceId,
    requireNotionSecrets
  );
  await putSecret(
    "NOTION_PAGES_DATA_SOURCE_ID",
    wireInputs.notionPagesDataSourceId,
    requireNotionSecrets
  );

  return changed;
}

function finalize(
  result: ProvisionResult,
  _projectDir: string,
  slug: string
): ProvisionResult {
  // ---- 8. Status card ----
  p.outro("Provisioning summary");
  console.log("");
  const row = (label: string, status: "ok" | "warn" | "fail", detail: string) => {
    const icon = status === "ok" ? "✅" : status === "warn" ? "⚠️ " : "❌";
    console.log(`  ${icon}  ${label.padEnd(20)} ${detail}`);
  };
  row("D1", result.d1.ok ? "ok" : "fail", result.d1.ok ? `${slug}-db (${result.d1.id?.slice(0, 8)}…)` : (result.d1.message ?? "failed"));
  row("KV", result.kv.ok ? "ok" : "fail", result.kv.ok ? `CONTENT_CACHE (${result.kv.id?.slice(0, 8)}…)` : (result.kv.message ?? "failed"));
  row(
    "KV (cache)",
    result.vinextKv.ok ? "ok" : "fail",
    result.vinextKv.ok
      ? `VINEXT_KV_CACHE (${result.vinextKv.id?.slice(0, 8)}…)`
      : (result.vinextKv.message ?? "failed")
  );
  row("R2", result.r2.ok ? "ok" : "fail", result.r2.ok ? `${slug}-assets` : (result.r2.message ?? "failed"));
  row("Migrations", result.migrationsApplied ? "ok" : "warn", result.migrationsApplied ? "applied locally" : "skipped or failed (run `pnpm run migrate:local` after install)");
  row(
    "Turnstile",
    result.turnstile.ok ? "ok" : result.turnstile.skipped ? "warn" : "fail",
    result.turnstile.ok
      ? `${result.turnstile.sitekey?.slice(0, 12)}…`
      : result.turnstile.skipped
        ? "skipped (configure manually — see README)"
        : (result.turnstile.message ?? "failed")
  );
  row(
    "Notion",
    result.notion.ok ? "ok" : result.notion.skipped ? "warn" : "fail",
    result.notion.ok
      ? `content ${result.notion.dataSourceId?.slice(0, 8)}… (${result.notion.seeded ?? 0} posts), pages ${result.notion.pagesDataSourceId?.slice(0, 8)}… (${result.notion.pagesSeeded ?? 0} pages)${result.notion.message ? " (" + result.notion.message + ")" : ""}`
      : result.notion.skipped
        ? "skipped (set NOTION_API_TOKEN or run `ntn login` to auto-create)"
        : (result.notion.message ?? "failed")
  );
  row("Resend", result.resend.enabled ? "ok" : "warn", result.resend.enabled ? "enabled" : "skipped (configure manually — see README)");
  row("Google", result.google.enabled ? "ok" : "warn", result.google.enabled ? "enabled" : "skipped (configure manually — see README)");
  row(
    "Admin",
    result.admin.ok ? "ok" : "fail",
    result.admin.ok
      ? `${result.admin.email} (${result.admin.message ?? "ok"})`
      : (result.admin.message ?? "failed")
  );
  row(
    "Worker",
    result.deploy.ok ? "ok" : "fail",
    result.deploy.ok
      ? result.deploy.url ?? `deployed (${result.deploy.workerName})`
      : result.deploy.skipped
        ? "skipped (run `pnpm exec vinext deploy` inside the project to deploy)"
        : (result.deploy.message ?? "failed")
  );

  return result;
}
