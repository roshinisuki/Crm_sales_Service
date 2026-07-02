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
  async redirects() {
    return [
      // Handle underscore/legacy URL variants that users may type or have bookmarked
      {
        source: "/sales_pipeline/:id/opportunity_detail",
        destination: "/sales-pipeline/:id/opportunity-detail",
        permanent: true,
      },
      {
        source: "/sales_pipeline/:path*",
        destination: "/sales-pipeline/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
