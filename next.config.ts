import type { NextConfig } from "next";

// Cache Components is intentionally off: every page in this app is per-user and
// authorization-dependent, so there is nothing safe to prerender or share.
const nextConfig: NextConfig = {
  // Keep the dev-only indicator away from the sidebar's sign-out button.
  devIndicators: { position: "bottom-right" },
  turbopack: {
    rules: {
      "*.css": {
        // Only our own CSS; next/font's generated CSS is "foreign" and must not go through Tailwind.
        condition: { not: "foreign" },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "dash-media.yoshlarventures.uz" }],
    qualities: [75],
    // Portfolio logos rarely change, and YV's media host is slow: keep optimized copies for 31 days.
    minimumCacheTTL: 2_678_400,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
