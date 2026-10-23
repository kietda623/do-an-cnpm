import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(packageRoot, "../../.env.test"), quiet: true });
const mode = process.argv[2] ?? "unit";
const projects = {
  unit: ["unit"],
  integration: ["integration"],
  contracts: ["contracts"],
  all: ["unit", "integration"],
};

if (!(mode in projects)) {
  console.error("Usage: pnpm test[:unit|:integration] [unit|integration|all]");
  process.exit(2);
}

const jestCli = resolve(packageRoot, "node_modules/jest/bin/jest.js");
const result = spawnSync(
  process.execPath,
  [
    "--experimental-vm-modules",
    jestCli,
    "--config",
    "jest.config.cjs",
    "--runInBand",
    "--selectProjects",
    ...projects[mode],
  ],
  {
    cwd: packageRoot,
    env: { ...process.env, API_TEST_MODE: mode },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Could not start Jest: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
