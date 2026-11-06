import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so a stray lockfile in the home dir is ignored.
    root: __dirname,
  },
  // The site used to have two versions; send old /v1 and /v2 links home.
  async redirects() {
    return [
      { source: "/v1", destination: "/", permanent: true },
      { source: "/v2", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
