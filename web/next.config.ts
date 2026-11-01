import type { NextConfig } from "next";

// Security headers for every page. The ERP is never shown inside another site (clickjacking).
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // only our own document viewer may frame our pages
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Every ERP page is behind a login and personal to the user, so pages render fresh on each request
  // (Cache Components is for public pages with static parts; it stays off here).
  output: "standalone", // small self-contained server for the Docker image
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
