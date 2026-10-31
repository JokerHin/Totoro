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
};

export default nextConfig;
