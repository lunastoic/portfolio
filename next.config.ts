import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so a stray lockfile in the home dir is ignored.
    root: __dirname,
  },
};

export default nextConfig;
