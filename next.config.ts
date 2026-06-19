import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000', '*.devtunnels.ms'],
    },
  },
  env: {
    NEXT_PUBLIC_CRM_VARIANT: process.env.NEXT_PUBLIC_CRM_VARIANT || "1",
  },
};

export default nextConfig;
