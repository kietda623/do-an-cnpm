import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(import.meta.url);

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost"))
    return true;
  const address = normalized.startsWith("[")
    ? normalized.slice(1, -1)
    : normalized;
  if (isIP(address) === 4) return address.startsWith("127.");
  if (address === "::1") return true;
  if (isIP(address) === 6 && address.startsWith("::ffff:")) {
    const firstMappedWord = Number.parseInt(address.slice(7).split(":")[0], 16);
    return (
      Number.isFinite(firstMappedWord) &&
      Math.floor(firstMappedWord / 256) === 127
    );
  }
  return false;
}

export function validateStorefrontUrl(rawValue, { development = false } = {}) {
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

  const hasStandardHttpsOrigin = url.protocol === "https:" && url.port === "";
  const isLocalDevelopmentUrl =
    development &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
    url.port === "3000";

  if (hasStandardHttpsOrigin && !isLoopbackHostname(url.hostname)) {
    return url.href;
  }
  if (isLocalDevelopmentUrl) return url.href;

  throw new Error(
    development
      ? "Use an HTTPS storefront or http://localhost:3000 (127.0.0.1 is also allowed) during development"
      : "Production desktop builds require a public HTTPS storefront on the standard port",
  );
}

export function createConfigOverride(mode, storefrontUrl) {
  if (mode !== "dev" && mode !== "build") {
    throw new Error("Tauri mode must be dev or build");
  }
  return {
    build: {
      frontendDist: storefrontUrl,
      ...(mode === "dev" ? { devUrl: storefrontUrl } : {}),
    },
  };
}

function runTauri(mode, storefrontUrl) {
  if (mode !== "dev" && mode !== "build") {
    throw new Error("Usage: node scripts/run-tauri.mjs <dev|build>");
  }

  const configDirectory = mkdtempSync(
    path.join(tmpdir(), "marketplace-desktop-"),
  );
  const configPath = path.join(configDirectory, "tauri.override.json");
  const configOverride = createConfigOverride(mode, storefrontUrl);
  writeFileSync(configPath, JSON.stringify(configOverride), "utf8");

  try {
    const cliPath = require.resolve("@tauri-apps/cli/tauri.js");
    const result = spawnSync(
      process.execPath,
      [cliPath, mode, "--config", configPath],
      {
        cwd: appRoot,
        env: { ...process.env, DESKTOP_STOREFRONT_URL: storefrontUrl },
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    rmSync(configDirectory, { recursive: true, force: true });
  }
}

function main() {
  const mode = process.argv[2];
  if (mode !== "dev" && mode !== "build") {
    throw new Error("Usage: node scripts/run-tauri.mjs <dev|build>");
  }
  try {
    process.loadEnvFile(path.resolve(appRoot, "../../.env"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const storefrontUrl = validateStorefrontUrl(
    process.env.DESKTOP_STOREFRONT_URL,
    {
      development: mode === "dev",
    },
  );
  process.exitCode = runTauri(mode, storefrontUrl);
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
