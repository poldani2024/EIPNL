import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/EIPNL',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
