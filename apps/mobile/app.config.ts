import type { ExpoConfig } from "expo/config";

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
if (!rawApiUrl) throw new Error("EXPO_PUBLIC_API_URL is required");
const apiBaseUrl = new URL(rawApiUrl);
const allowDevHttp =
  process.env.APP_VARIANT === "development" &&
  process.env.EXPO_ALLOW_HTTP === "1";
if (
  apiBaseUrl.username ||
  apiBaseUrl.password ||
  apiBaseUrl.search ||
  apiBaseUrl.hash
)
  throw new Error(
    "API URL must not include credentials, query parameters, or a fragment",
  );
if (
  apiBaseUrl.protocol !== "https:" &&
  !(apiBaseUrl.protocol === "http:" && allowDevHttp)
)
  throw new Error(
    "API requires HTTPS, or HTTP with APP_VARIANT=development and EXPO_ALLOW_HTTP=1",
  );
if (apiBaseUrl.pathname === "/" || apiBaseUrl.pathname === "")
  apiBaseUrl.pathname = "/api/v1";
if (apiBaseUrl.pathname.replace(/\/+$/, "") !== "/api/v1")
  throw new Error("API URL must end in /api/v1");
const config: ExpoConfig = {
  name: "Marketplace Buyer",
  slug: "marketplace-buyer",
  scheme: "marketplace-buyer",
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      { android: { usesCleartextTraffic: allowDevHttp } },
    ],
  ],
  android: { package: "com.marketplace.buyer" },
  ios: { bundleIdentifier: "com.marketplace.buyer" },
  extra: { apiBaseUrl: apiBaseUrl.toString() },
};
export default config;
