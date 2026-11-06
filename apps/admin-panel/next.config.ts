import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@marketplace/design-tokens", "@marketplace/ui-web"],
};

export default nextConfig;
