import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // xlsx 가져오기용 (기본값 1mb → 20mb 로 확장)
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
