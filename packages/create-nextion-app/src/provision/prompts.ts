// packages/create-nextion-app/src/provision/prompts.ts
//
// Interactive (and silent) prompts for the post-render provisioning
// stage. Each prompt is a no-op when not running in a TTY (e.g. when
// the scaffolder is invoked with `--yes` or piped). Callers must
// tolerate `null` returns — they translate to "skip this step".

import * as p from "@clack/prompts";
import type { AnswersContentField } from "../prompt.js";

export interface PromptContext {
  /** True when stdin is a TTY (interactive). */
  interactive: boolean;
}

export interface OptionalResend {
  apiKey: string;
  fromAddress: string;
}

export interface OptionalGoogle {
  clientId: string;
  clientSecret: string;
  /** The redirect URI the user should paste into Google Cloud Console. */
  redirectUri: string;
}

export interface OptionalNotion {
  apiToken: string;
  parentPageId: string;
  seedCount: number;
}

const SAFE_NON_TTY: OptionalResend | OptionalGoogle | OptionalNotion | null = null;

/** "Enable Resend email verification? (y/N)". Skipped silently if !interactive. */
export async function promptResend(ctx: PromptContext): Promise<OptionalResend | null> {
  if (!ctx.interactive) return null;
  const enable = await p.confirm({
    message: "Enable Resend email verification? (no = auth falls back to no-op)",
    initialValue: false,
  });
  if (p.isCancel(enable) || !enable) return null;
  const apiKey = await p.password({
    message: "Resend API key (re_…)",
    validate: (v) =>
      !v || v.trim().length === 0 ? "Required when enabling Resend" : undefined,
  });
  if (p.isCancel(apiKey)) return null;
  const fromAddress = await p.text({
    message: "Resend sender address",
    placeholder: "no-reply@example.com",
    initialValue: "no-reply@example.com",
    validate: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? undefined : "Must be an email address"),
  });
  if (p.isCancel(fromAddress)) return null;
  return { apiKey: String(apiKey), fromAddress: String(fromAddress) };
}

/** "Enable Google sign-in? (y/N)". Skipped silently if !interactive. */
export async function promptGoogle(
  ctx: PromptContext,
  siteUrl: string
): Promise<OptionalGoogle | null> {
  if (!ctx.interactive) return null;
  const enable = await p.confirm({
    message: "Enable Google sign-in? (you'll need a Google Cloud OAuth client)",
    initialValue: false,
  });
  if (p.isCancel(enable) || !enable) return null;
  const redirectUri = `${siteUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  p.log.info(
    `Add this redirect URI to your Google OAuth client:\n  ${redirectUri}`
  );
  const clientId = await p.text({
    message: "Google OAuth Client ID",
    validate: (v) => (v && v.trim().length > 0 ? undefined : "Required"),
  });
  if (p.isCancel(clientId)) return null;
  const clientSecret = await p.password({
    message: "Google OAuth Client Secret",
    validate: (v) => (v && v.trim().length > 0 ? undefined : "Required"),
  });
  if (p.isCancel(clientSecret)) return null;
  return {
    clientId: String(clientId),
    clientSecret: String(clientSecret),
    redirectUri,
  };
}

/**
 * "Wire up Notion now?" — only triggered if `NOTION_API_TOKEN` is not
 * already in env. Returns the token + parent page id the user types
 * in, or null to skip.
 */
export async function promptNotion(
  ctx: PromptContext,
  fields: AnswersContentField[]
): Promise<OptionalNotion | null> {
  if (!ctx.interactive) return null;
  p.log.info(
    "Notion: create an integration at https://www.notion.so/my-integrations, share a target page with it, then paste the token below."
  );
  const apiToken = await p.password({
    message: "Notion integration token (secret_…) — Enter to skip",
  });
  if (p.isCancel(apiToken) || !apiToken) return null;
  const parentPageId = await p.text({
    message: "Parent page id (the page your integration can edit)",
    placeholder: "00000000000000000000000000000000",
    validate: (v) =>
      !v || !/^[0-9a-f]{32}$/.test(v.trim())
        ? "Must be a 32-char hex page id"
        : undefined,
  });
  if (p.isCancel(parentPageId)) return null;
  const seedCountRaw = await p.text({
    message: "How many sample pages to seed? (0 to skip)",
    placeholder: "3",
    initialValue: "3",
    validate: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 50
        ? undefined
        : "Enter an integer 0–50";
    },
  });
  if (p.isCancel(seedCountRaw)) return null;
  return {
    apiToken: String(apiToken).trim(),
    parentPageId: String(parentPageId).trim(),
    seedCount: Number(seedCountRaw),
  };
}

export const _internal = { SAFE_NON_TTY };
