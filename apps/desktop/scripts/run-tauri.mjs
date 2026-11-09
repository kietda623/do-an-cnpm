import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(import.meta.url);
export const DEFAULT_DEMO_STOREFRONT_URL = "http://localhost:3000";

export function validateStorefrontUrl(rawValue = DEFAULT_DEMO_STOREFRONT_URL) {
  if (
    typeof rawValue !== "string" ||
    rawValue.length === 0 ||
    rawValue !== rawValue.trim()
  ) {
    throw new Error(
      "DESKTOP_STOREFRONT_URL must be a non-empty URL without surrounding whitespace",
    );
  }

  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("DESKTOP_STOREFRONT_URL must be a valid absolute URL");
  }

  if (
    url.username !== "" ||
    url.password !== "" ||
    rawValue.includes("?") ||
    rawValue.includes("#")
  ) {
    throw new Error(
      "DESKTOP_STOREFRONT_URL must not contain credentials, a query, or a fragment",
    );
  }

  const isLocalDemoUrl =
    url.protocol === "http:" &&
    url.hostname === "localhost" &&
    url.port === "3000";

  if (isLocalDemoUrl) return url.href;

  throw new Error("The Windows desktop demo only allows http://localhost:3000");
}

function runTauri(storefrontUrl) {
  const cliPath = require.resolve("@tauri-apps/cli/tauri.js");
  const result = spawnSync(process.execPath, [cliPath, "dev"], {
    cwd: appRoot,
    env: { ...process.env, DESKTOP_STOREFRONT_URL: storefrontUrl },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  if (process.argv[2] !== "dev") {
    throw new Error("Usage: node scripts/run-tauri.mjs dev");
  }
  try {
    process.loadEnvFile(path.resolve(appRoot, "../../.env"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const storefrontUrl = validateStorefrontUrl(
    process.env.DESKTOP_STOREFRONT_URL || undefined,
  );
  process.exitCode = runTauri(storefrontUrl);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
