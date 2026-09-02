import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), tools=(self)" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Origin-Agent-Cluster", value: "?1" },
      ],
    }];
  },
};

export default nextConfig;
