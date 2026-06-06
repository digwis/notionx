import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 给公开博客页（不读 cookies 的页面）打边缘缓存头。
  // s-maxage = 边缘 PoP 缓存 TTL（CF CDN 命中即 ~50ms 出页面）
  // stale-while-revalidate = TTL 过期后还能直接给旧版，120 秒内重新生成
  // 不设 max-age = 浏览器每次都重新校验，强制走 prefetch 的 RSC 缓存
  async headers() {
    return [
      {
        source: "/blog",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
      {
        source: "/blog/:slug",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=120, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
