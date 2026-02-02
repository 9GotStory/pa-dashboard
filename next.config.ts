import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'export',
  // GitHub Pages repository name
  basePath: isProd ? '/pa-dashboard' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
