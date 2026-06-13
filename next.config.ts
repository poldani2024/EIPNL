import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows reading/writing to the data directory at runtime
  serverExternalPackages: [],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
