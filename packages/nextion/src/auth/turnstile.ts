// auth/turnstile.ts - Cloudflare Turnstile server-side token verification.
// Widget: https://dash.cloudflare.com/?to=/:account/turnstile
// Same Cloudflare account as Workers, but created as a separate Turnstile product.

import { workerEnv } from "../util/env";
import { getTurnstilePublicConfig } from "../internal/admin/settings";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileRuntimeConfig = {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
};

/** 是否应对当前请求执行 Turnstile 校验（开关 + site key + secret 齐全）。 */
export async function getTurnstileRuntimeConfig(): Promise<TurnstileRuntimeConfig | null> {
  const pub = await getTurnstilePublicConfig();
  const secretKey = workerEnv.TURNSTILE_SECRET_KEY?.trim();
  if (!pub.enabled || !pub.siteKey || !secretKey) return null;
  return { enabled: true, siteKey: pub.siteKey, secretKey };
}

type SiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null
): Promise<{ ok: true } | { ok: false; codes: string[] }> {
  const config = await getTurnstileRuntimeConfig();
  if (!config) {
    // #region debug-point C:runtime-config-missing
    console.error("[DEBUG-TURNSTILE] runtime config missing", {
      tokenLength: token.length,
      remoteIpPresent: Boolean(remoteIp),
    });
    // #endregion
    return { ok: true };
  }

  if (!token) {
    // #region debug-point B:missing-token
    console.error("[DEBUG-TURNSTILE] missing token", {
      siteKeySuffix: config.siteKey.slice(-6),
      remoteIpPresent: Boolean(remoteIp),
    });
    // #endregion
    return { ok: false, codes: ["missing-input-response"] };
  }

  const body = new URLSearchParams();
  body.set("secret", config.secretKey);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    // #region debug-point C:siteverify-http-error
    console.error("[DEBUG-TURNSTILE] siteverify http error", {
      siteKeySuffix: config.siteKey.slice(-6),
      tokenLength: token.length,
      status: res.status,
    });
    // #endregion
    return { ok: false, codes: [`http-${res.status}`] };
  }

  const data = (await res.json()) as SiteverifyResponse;
  if (data.success) return { ok: true };
  // #region debug-point C:siteverify-failed
  console.error("[DEBUG-TURNSTILE] siteverify failed", {
    siteKeySuffix: config.siteKey.slice(-6),
    tokenLength: token.length,
    codes: data["error-codes"] ?? ["verification-failed"],
  });
  // #endregion
  return { ok: false, codes: data["error-codes"] ?? ["verification-failed"] };
}

export async function verifyTurnstileFromForm(
  formData: FormData,
  remoteIp: string | null
): Promise<{ ok: true } | { ok: false }> {
  const token = String(formData.get("cf-turnstile-response") ?? "").trim();
  // #region debug-point B:form-token-read
  console.error("[DEBUG-TURNSTILE] form token read", {
    tokenLength: token.length,
    remoteIpPresent: Boolean(remoteIp),
  });
  // #endregion
  const result = await verifyTurnstileToken(token, remoteIp);
  return result.ok ? { ok: true } : { ok: false };
}
