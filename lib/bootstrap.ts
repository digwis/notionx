// lib/bootstrap.ts - 启动期初始化：确保管理员账号存在
// 触发时机：任何受保护后台页面第一次访问时
// 行为：
//   1) 读取 app_settings，确认 admin_email
//   2) 如果该邮箱 user 不存在：用 ADMIN_PASSWORD 作为初始密码创建（仅首次）
//   3) 将其 role 设为 'admin'
//   4) 写入 email_verified = 1

import { workerEnv } from "./env";
import { getAppSettings } from "./settings";
import { hashPassword } from "./passwords";
import { getUserByEmail } from "./users";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function ensureAdminBootstrap(): Promise<void> {
  const env = workerEnv;
  const settings = await getAppSettings();
  const adminEmail = normalizeEmail(settings.admin_email);
  if (!adminEmail) return;

  const existing = await getUserByEmail(adminEmail);
  if (!existing) {
    // 首次启动：用管理员密码（ADMIN_PASSWORD）作为初始密码
    const adminPwd = env.ADMIN_PASSWORD || "vinext-admin-2026";
    const passwordHash = await hashPassword(adminPwd);
    await env.DB.prepare(
      `INSERT INTO users (
        email, password_hash, email_verified, role, last_seen_at
      ) VALUES (?, ?, 1, 'admin', datetime('now'))`
    )
      .bind(adminEmail, passwordHash)
      .run();
    return;
  }

  if (existing.role !== "admin" || existing.email_verified !== 1) {
    await env.DB.prepare(
      `UPDATE users
          SET role = 'admin', email_verified = 1
        WHERE email = ?`
    ).bind(adminEmail).run();
  }
}
