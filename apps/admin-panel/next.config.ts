import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@marketplace/design-tokens", "@marketplace/ui-web"],
};

export default nextConfig;
