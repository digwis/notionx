import { workerEnv } from "./env";

/** 站点公网 URL，用于邮件验证/重置密码链接。 */
export function getSiteUrl(): string {
  return workerEnv.SITE_URL || "";
}
