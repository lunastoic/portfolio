import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so a stray lockfile in the home dir is ignored.
    root: __dirname,
  },
  // v2 is now the home page; send old /v2 links there.
  async redirects() {
    return [{ source: "/v2", destination: "/", permanent: true }];
  },
};

export default nextConfig;
