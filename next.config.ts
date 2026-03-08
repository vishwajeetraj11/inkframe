import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "remotion"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
