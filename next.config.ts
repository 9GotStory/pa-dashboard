import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'export',
  // next dev writes AGENTS.md when it detects an AI agent; CLAUDE.md points
  // agents at node_modules/next/dist/docs/ instead
  agentRules: false,
  // GitHub Pages repository name
  basePath: isProd ? '/pa-dashboard' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
