import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
]);
const lintExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);

function hasLintSource(directory) {
  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) {
      return !ignoredDirectories.has(entry.name) && hasLintSource(join(directory, entry.name));
    }
    return lintExtensions.has(extname(entry.name));
  });
}

if (!hasLintSource(process.cwd())) {
  console.log("No JavaScript or TypeScript files yet; lint skipped.");
  process.exit(0);
}

const result = spawnSync("eslint", ["."], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
