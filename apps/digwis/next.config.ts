import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add project-specific headers, redirects, or rewrites here.

  // Allow `next/image` to load cover art hosted by Notion and the
  // common placeholder hosts the scaffolder seeds into sample posts.
  // Adjust this list if you self-host covers on R2 or another CDN.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "www.notion.so" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
