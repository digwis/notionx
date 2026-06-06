import { headers } from "next/headers";

/** 从 Cloudflare / 反向代理请求头解析客户端 IP。 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const forwarded = h.get("x-forwarded-for")?.trim();
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = h.get("x-real-ip")?.trim();
  return realIp || null;
}
