import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Standalone output for Docker multi-stage builds */
  output: "standalone",

  /* Config options */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // In local dev, proxy /api to FastAPI running on port 8000
    // In production behind ALB, ALB routes /api directly before reaching Next.js
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
