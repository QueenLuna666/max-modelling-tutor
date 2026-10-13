import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API routes read prompts/*.md from disk; make sure Vercel ships them.
  outputFileTracingIncludes: {
    "/api/**": ["./prompts/**"],
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
