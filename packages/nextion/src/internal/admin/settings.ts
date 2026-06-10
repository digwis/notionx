// lib/settings.ts - 读取和更新后台系统设置（单管理员模型）
// 数据保存在 SQL 表 app_settings，目前固定为 1 行。
//
// Internal to the package — not exposed via package.json exports. The
// auth helpers (turnstile.ts, users.ts) call into the read functions;
// admin pages in the starter import the update functions through a
// re-export shim at `apps/moviebluebook/lib/settings.ts`.

import { cache } from "react";
import { workerEnv } from "../../util/env";
import { getDatabase } from "../../platform/current";
import {
  buildTurnstilePublicConfig,
  DEFAULT_TURNSTILE_PUBLIC_CONFIG,
  isSchemaDriftError,
} from "./schema-guard";

export type AppSettings = {
  site_title: string;
  google_enabled: 0 | 1;
  google_client_id: string | null;
  google_client_secret: string | null;
  google_updated_at: string | null;
  turnstile_enabled: 0 | 1;
  turnstile_site_key: string | null;
  turnstile_updated_at: string | null;
  admin_email: string;
  updated_at: string;
};

type Row = {
  site_title: string;
  google_enabled: number;
  google_client_id: string | null;
  google_client_secret: string | null;
  google_updated_at: string | null;
  turnstile_enabled: number;
  turnstile_site_key: string | null;
  turnstile_updated_at: string | null;
  admin_email: string;
  updated_at: string;
};

const DEFAULT_ADMIN_EMAIL = "zhaofilms@gmail.com";

function rowToSettings(r: Row): AppSettings {
  return {
    site_title: r.site_title,
    google_enabled: r.google_enabled === 1 ? 1 : 0,
    google_client_id: r.google_client_id,
    google_client_secret: r.google_client_secret,
    google_updated_at: r.google_updated_at,
    turnstile_enabled: r.turnstile_enabled === 1 ? 1 : 0,
    turnstile_site_key: r.turnstile_site_key,
    turnstile_updated_at: r.turnstile_updated_at,
    admin_email: r.admin_email,
    updated_at: r.updated_at,
  };
}

const getAppSettingsCached = cache(async (): Promise<AppSettings> => {
  const row = await getDatabase().prepare(
    `SELECT site_title, google_enabled, google_client_id, google_client_secret,
            google_updated_at, turnstile_enabled, turnstile_site_key,
            turnstile_updated_at, admin_email, updated_at
       FROM app_settings WHERE id = 1`
  ).first<Row>();
  if (!row) {
    // 极端情况：迁移未执行
    return {
      site_title: "vinext Blog",
      google_enabled: 0,
      google_client_id: null,
      google_client_secret: null,
      google_updated_at: null,
      turnstile_enabled: 0,
      turnstile_site_key: null,
      turnstile_updated_at: null,
      admin_email: DEFAULT_ADMIN_EMAIL,
      updated_at: "",
    };
  }
  return rowToSettings(row);
});

export async function getAppSettings(): Promise<AppSettings> {
  return getAppSettingsCached();
}

/** Turnstile 前端可见配置（site key 公开；secret 在 env）。 */
export async function getTurnstilePublicConfig(): Promise<{
  enabled: boolean;
  siteKey: string | null;
  secretConfigured: boolean;
}> {
  try {
    const s = await getAppSettings();
    return buildTurnstilePublicConfig(s, workerEnv);
  } catch (error) {
    if (isSchemaDriftError(error)) {
      console.error(
        "[settings] turnstile config unavailable due to schema drift; falling back to disabled state",
        error
      );
      return { ...DEFAULT_TURNSTILE_PUBLIC_CONFIG };
    }
    throw error;
  }
}

export async function updateTurnstileConfig(input: {
  enabled: boolean;
  siteKey: string;
}): Promise<void> {
  const enabled = input.enabled ? 1 : 0;
  await getDatabase().prepare(
    `UPDATE app_settings
        SET turnstile_enabled = ?,
            turnstile_site_key = ?,
            turnstile_updated_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = 1`
  )
    .bind(enabled, input.siteKey || null)
    .run();
}

export async function disableTurnstileConfig(): Promise<void> {
  await getDatabase().prepare(
    `UPDATE app_settings
        SET turnstile_enabled = 0,
            turnstile_updated_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = 1`
  ).run();
}

/** Google 登录实际配置：只有 enabled 且 id+secret 都存在才认为可用 */
export async function getGoogleOAuthConfig(): Promise<{
  enabled: boolean;
  clientId: string;
  clientSecret: string;
} | null> {
  const s = await getAppSettings();
  if (!s.google_enabled) return null;
  if (!s.google_client_id || !s.google_client_secret) return null;
  return {
    enabled: true,
    clientId: s.google_client_id,
    clientSecret: s.google_client_secret,
  };
}

export async function updateGoogleOAuthConfig(input: {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const enabled = input.enabled ? 1 : 0;
  await getDatabase().prepare(
    `UPDATE app_settings
        SET google_enabled = ?,
            google_client_id = ?,
            google_client_secret = ?,
            google_updated_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = 1`
  )
    .bind(enabled, input.clientId, input.clientSecret)
    .run();
}

export async function clearGoogleOAuthConfig(): Promise<void> {
  await getDatabase().prepare(
    `UPDATE app_settings
        SET google_enabled = 0,
            google_client_id = NULL,
            google_client_secret = NULL,
            google_updated_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = 1`
  ).run();
}

export async function updateSiteTitle(title: string): Promise<void> {
  await getDatabase().prepare(
    `UPDATE app_settings SET site_title = ?, updated_at = datetime('now') WHERE id = 1`
  )
    .bind(title)
    .run();
}
