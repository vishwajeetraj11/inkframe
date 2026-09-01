import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elah/core",
    "@elah/editor",
    "@elah/react",
    "@elah/timeline",
  ],
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/vercel",
    "@vercel/blob",
    "@vercel/sandbox",
    "remotion",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
