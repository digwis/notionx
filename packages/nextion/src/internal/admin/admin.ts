// lib/admin.ts - 单管理员身份识别
// 设计：固定 admin_email = app_settings.admin_email（默认 zhaofilms@gmail.com）
// 任何登录方式下，邮箱匹配即视为管理员。
//
// Internal to the package — not exposed via package.json exports.
// The auth helpers (users.ts) call `isAdminEmail` to decide whether a
// newly registered user gets the `admin` role. Consumer apps may
// re-export this for backward compatibility with local imports.

import { getAppSettings } from "./settings";
import { getDatabase } from "../../platform/current";

export const DEFAULT_ADMIN_EMAIL = "zhaofilms@gmail.com";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isAdminEmail(email: string): Promise<boolean> {
  if (!email) return false;
  const settings = await getAppSettings();
  return normalizeEmail(email) === normalizeEmail(settings.admin_email);
}

/**
 * 提升某邮箱为管理员（仅在系统启动时、且匹配 admin_email 时调用）。
 * 实际上是把 users.role 置为 'admin'，并清空其它冲突状态。
 */
export async function ensureAdminUser(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!(await isAdminEmail(normalized))) return;
  await getDatabase().prepare(
    `UPDATE users SET role = 'admin' WHERE email = ?`
  ).bind(normalized).run();
}
