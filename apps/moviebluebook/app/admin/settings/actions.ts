"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearGoogleOAuthConfig,
  disableTurnstileConfig,
  getAppSettings,
  updateGoogleOAuthConfig,
  updateSiteTitle,
  updateTurnstileConfig,
} from "@/lib/settings";
import { workerEnv } from "@/lib/env";
import { ensureAdminBootstrap } from "@/lib/bootstrap";
import { getAuthViewer } from "@/lib/auth";

async function requireAdminOrRedirect(): Promise<void> {
  const viewer = await getAuthViewer();
  if (!viewer) redirect("/login");
  await ensureAdminBootstrap();
  if (!viewer.isAdmin) {
    redirect("/admin?error=需要管理员权限");
  }
}

function readEnabled(formData: FormData): boolean {
  return formData.get("google_enabled") === "1";
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveGoogleSettingsAction(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();

  const enabled = readEnabled(formData);
  let clientId = readText(formData, "google_client_id");
  let clientSecret = readText(formData, "google_client_secret");

  const current = await getAppSettings();

  // Secret 输入框留空表示不修改
  if (!clientSecret && current.google_client_secret) {
    clientSecret = current.google_client_secret;
  }
  if (!clientId && current.google_client_id) {
    clientId = current.google_client_id;
  }

  if (enabled && (!clientId || !clientSecret)) {
    redirect("/admin/settings?error=启用 Google 登录必须填写 Client ID 和 Secret");
  }

  await updateGoogleOAuthConfig({
    enabled,
    clientId,
    clientSecret,
  });

  await revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=google");
}

export async function disableGoogleSettingsAction(): Promise<void> {
  await requireAdminOrRedirect();
  await clearGoogleOAuthConfig();
  await revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=disabled");
}

export async function saveSiteTitleAction(formData: FormData): Promise<void> {
  await requireAdminOrRedirect();
  const title = readText(formData, "site_title").slice(0, 80);
  if (!title) redirect("/admin/settings?error=站点名称不能为空");
  await updateSiteTitle(title);
  await revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=title");
}

function readTurnstileEnabled(formData: FormData): boolean {
  return formData.get("turnstile_enabled") === "1";
}

export async function saveTurnstileSettingsAction(
  formData: FormData
): Promise<void> {
  await requireAdminOrRedirect();

  const enabled = readTurnstileEnabled(formData);
  let siteKey = readText(formData, "turnstile_site_key");
  const current = await getAppSettings();

  if (!siteKey && current.turnstile_site_key) {
    siteKey = current.turnstile_site_key;
  }

  if (enabled) {
    if (!siteKey) {
      redirect("/admin/settings?error=启用 Turnstile 必须填写 Site Key");
    }
    if (!workerEnv.TURNSTILE_SECRET_KEY?.trim()) {
      redirect(
        "/admin/settings?error=请先用 wrangler secret put TURNSTILE_SECRET_KEY 配置 Secret Key"
      );
    }
  }

  await updateTurnstileConfig({ enabled, siteKey });
  await Promise.all([
    revalidatePath("/admin/settings"),
    revalidatePath("/login"),
    revalidatePath("/register"),
    revalidatePath("/forgot-password"),
  ]);
  redirect("/admin/settings?saved=turnstile");
}

export async function disableTurnstileSettingsAction(): Promise<void> {
  await requireAdminOrRedirect();
  await disableTurnstileConfig();
  await Promise.all([
    revalidatePath("/admin/settings"),
    revalidatePath("/login"),
    revalidatePath("/register"),
    revalidatePath("/forgot-password"),
  ]);
  redirect("/admin/settings?saved=turnstile_disabled");
}
