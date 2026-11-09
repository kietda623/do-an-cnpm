import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  transpilePackages: ["@marketplace/design-tokens", "@marketplace/ui-web"],
};

export default nextConfig;
