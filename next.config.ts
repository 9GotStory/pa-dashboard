import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        // Internal service name and port are frozen deployment topology.
        destination: 'http://pa-dashboard-api:3001/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
