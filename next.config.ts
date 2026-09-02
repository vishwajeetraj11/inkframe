import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@elah/core",
    "@elah/editor",
    "@elah/react",
    "@elah/timeline",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
