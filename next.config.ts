import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    allowedOrigins: ['localhost:3000', '127.0.0.1:3000', 'sukisoftware.com', '*.sukisoftware.com'],
  },
};

export default nextConfig;
