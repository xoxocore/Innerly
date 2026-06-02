import type { NextConfig } from "next";

// Set EXPORT_STATIC=1 to emit a portable static build into ./out for offline review.
// Left off by default so the project stays a full Vercel/Supabase SaaS target.
const isExport = process.env.EXPORT_STATIC === "1";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        images: { unoptimized: true },
        assetPrefix: "./",
      }
    : {}),
};

export default nextConfig;
