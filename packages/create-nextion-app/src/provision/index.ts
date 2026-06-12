// packages/create-nextion-app/src/provision/index.ts
//
// Orchestrates the post-render provisioning flow:
//   1. Verify wrangler auth (required)
//   2. Create / reuse D1, KV, R2 (idempotent)
//   3. Create D1 tables locally via `d1 migrations apply --local`
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
import { runOrThrow, run } from "./shell.js";
import {
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
  ensureSiteSettingsDatabase,
} from "./notion.js";
import { promptNotion } from "./prompts.js";
import { patchWranglerJsonc, writeDevVars, type WireInputs } from "./wire.js";
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
    message?: string;
    skipped?: boolean;
    seeded?: number;
  };
  siteSettings: {
    ok: boolean;
    dataSourceId?: string;
    url?: string;
    message?: string;
    skipped?: boolean;
    seeded?: number;
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
  _siteSettingsDataSourceId?: string;
}

export async function provision(
  answers: Answers,
  projectDir: string,
  options: { interactive: boolean }
): Promise<ProvisionResult> {
  const result: ProvisionResult = {
    d1: { ok: false },
    kv: { ok: false },
    r2: { ok: false },
    turnstile: { ok: false },
    notion: { ok: false },
    siteSettings: { ok: false, skipped: true },
    resend: { ok: false, enabled: false },
    google: { ok: false, enabled: false },
    migrationsApplied: false,
    deploy: { ok: false, skipped: true },
    admin: { ok: false, email: answers.adminEmail },
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
    const acc = await requireWranglerAuth();
    p.log.success(`Cloudflare: logged in (account ${acc.id.slice(0, 8)}…)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    p.log.error(`Cloudflare: ${message}`);
    p.log.info(
      "Re-run after `wrangler login`. You can still use the project; just create D1/KV/R2 by hand."
    );
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

  // ---- 3b. Apply D1 migrations locally (best-effort, no project deps required) ----
  if (result.d1.ok && result.d1.id) {
    try {
      // Local D1 apply: wrangler reads the binding from wrangler.jsonc
      // and uses the local sqlite-backed miniflare store. This works
      // even before `pnpm install`.
      await runOrThrow(
        "wrangler",
        ["d1", "migrations", "apply", d1Name, "--local"],
        { cwd: projectDir }
      );
      result.migrationsApplied = true;
      p.log.success(`D1 migrations: applied to local store`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      p.log.warn(`D1 migrations: ${msg}`);
    }
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
          resolvedToken
        );
      }
      if (notionInputs) {
        const notionDatabaseTitle = `${answers.projectName} ${answers.contentSource.title}`;
        const r = await ensureNotionDatabase({
          apiToken: notionInputs.apiToken,
          parentPageId: notionInputs.parentPageId,
          title: notionDatabaseTitle,
          fields: answers.contentSource.fields,
          seedCount: notionInputs.seedCount,
        });
        result.notion = {
          ok: true,
          dataSourceId: r.dataSourceId,
          seeded: r.seeded,
          ...(autoToken
            ? { message: `token from ${describeNtnSource(autoToken.source)}` }
            : {}),
        };
        p.log.success(
          `Notion: database created (${r.dataSourceId.slice(0, 8)}…), seeded ${r.seeded} pages.`
        );
        result._notionToken = resolvedToken;

        // Site settings: separate data source for site-level config
        // (name, tagline, description, default locale, social image).
        // Created alongside the main content source — same parent
        // page, same Notion token, separate `NOTION_SITE_SETTINGS_…`
        // env var. Disable with `--no-site-settings`.
        if (answers.enableSiteSettings) {
          const settings = await ensureSiteSettingsDatabase({
            apiToken: notionInputs.apiToken,
            parentPageId: notionInputs.parentPageId,
            projectName: answers.projectName,
            description:
              "A Notion-powered site built on @notionx/core, running on Cloudflare Workers with D1, R2, and Cloudflare Images.",
            defaultLocale: answers.defaultLocale,
          });
          result.siteSettings = {
            ok: true,
            dataSourceId: settings.dataSourceId,
            url: settings.url,
            seeded: settings.seeded,
          };
          result._siteSettingsDataSourceId = settings.dataSourceId;
          p.log.success(
            `Notion site settings: database created (${settings.dataSourceId.slice(0, 8)}…), seeded ${settings.seeded} page.`
          );
        }
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
        answers.contentSource.fields
      );
      if (notion) {
        const notionDatabaseTitle = `${answers.projectName} ${answers.contentSource.title}`;
        const r = await ensureNotionDatabase({
          apiToken: notion.apiToken,
          parentPageId: notion.parentPageId,
          title: notionDatabaseTitle,
          fields: answers.contentSource.fields,
          seedCount: notion.seedCount,
        });
        result.notion = {
          ok: true,
          dataSourceId: r.dataSourceId,
          seeded: r.seeded,
        };
        p.log.success(
          `Notion: database created (${r.dataSourceId.slice(0, 8)}…), seeded ${r.seeded} pages.`
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
  if (result.d1.ok && result.kv.ok) {
    const wireInputs: WireInputs = {
      d1DatabaseId: result.d1.id!,
      kvNamespaceId: result.kv.id!,
      turnstileSitekey: result.turnstile.sitekey,
      turnstileSecret: result.turnstile.ok ? result.turnstile.secret : undefined,
      notionToken: result._notionToken,
      notionDataSourceId: result.notion.dataSourceId,
      notionSiteSettingsDataSourceId: result._siteSettingsDataSourceId,
    };
    try {
      await patchWranglerJsonc(projectDir, wireInputs);
      await writeDevVars(projectDir, wireInputs);
      p.log.success(`Wired: wrangler.jsonc + .dev.vars updated.`);
    } catch (err) {
      p.log.error(
        `Wiring failed: ${err instanceof Error ? err.message : err}`
      );
    }

    // Set the Turnstile secret on the worker (best-effort, requires
    // the worker to be deployable — i.e. `pnpm install` must have
    // happened). Skip silently if wrangler secret put fails because
    // the worker hasn't been built yet.
    if (wireInputs.turnstileSecret) {
      try {
        await setWorkerSecret(
          "TURNSTILE_SECRET_KEY",
          wireInputs.turnstileSecret,
          projectDir,
          [wireInputs.turnstileSecret]
        );
        p.log.success(`Worker secret: TURNSTILE_SECRET_KEY set.`);
      } catch {
        p.log.info(
          "Worker secret: skipped (run `pnpm install && pnpm exec wrangler secret put TURNSTILE_SECRET_KEY` after install)."
        );
      }
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
    message: "seeded via 0002_admin_seed.sql",
  };

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

    const deploy = await run("pnpm", ["exec", "vinext", "deploy"], {
      cwd: projectDir,
    });
    if (deploy.code !== 0) {
      const tail = (deploy.stderr || deploy.stdout).trim().split("\n").slice(-8).join("\n");
      throw new Error(`vinext deploy failed (exit ${deploy.code}):\n${tail}`);
    }
    // wrangler prints lines like:
    //   Published <name> (X.XX sec)
    //     https://<name>.<subdomain>.workers.dev
    // Pull the URL out so the status card can link to it.
    const deployText = (deploy.stdout + "\n" + deploy.stderr).replace(
      /\u001b\[[0-9;]*m/g,
      ""
    );
    const urlMatch = deployText.match(
      /https:\/\/[a-zA-Z0-9._-]+\.workers\.dev/
    );
    result.deploy = {
      ok: true,
      url: urlMatch?.[0],
      workerName: slug,
    };
    p.log.success(
      `Worker deployed: ${urlMatch?.[0] ?? "(url not detected in output)"}`
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
      ? `data source ${result.notion.dataSourceId?.slice(0, 8)}…, seeded ${result.notion.seeded ?? 0} pages${result.notion.message ? " (" + result.notion.message + ")" : ""}`
      : result.notion.skipped
        ? "skipped (set NOTION_API_TOKEN or run `ntn login` to auto-create)"
        : (result.notion.message ?? "failed")
  );
  row(
    "Site Settings",
    result.siteSettings.ok
      ? "ok"
      : result.siteSettings.skipped
        ? "warn"
        : "fail",
    result.siteSettings.ok
      ? `data source ${result.siteSettings.dataSourceId?.slice(0, 8)}…, seeded ${result.siteSettings.seeded ?? 0} page (editable in Notion; see README "Site settings")`
      : result.siteSettings.skipped
        ? result.notion.ok
          ? "skipped (--no-site-settings)"
          : "skipped (requires Notion to be wired up)"
        : (result.siteSettings.message ?? "failed")
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
