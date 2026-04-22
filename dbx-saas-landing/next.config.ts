import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Keeps file tracing rooted in this app when other lockfiles exist in parent folders. */
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
