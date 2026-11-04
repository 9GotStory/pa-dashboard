import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'export',
  // next dev writes AGENTS.md when it detects an AI agent; CLAUDE.md points
  // agents at node_modules/next/dist/docs/ instead
  agentRules: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
