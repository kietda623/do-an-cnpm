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
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

function hasTypeScriptSource(directory) {
  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) {
      return (
        !ignoredDirectories.has(entry.name) && hasTypeScriptSource(join(directory, entry.name))
      );
    }
    return sourceExtensions.has(extname(entry.name));
  });
}

if (!hasTypeScriptSource(process.cwd())) {
  console.log("No TypeScript source files yet; typecheck skipped.");
  process.exit(0);
}

const result = spawnSync("tsc", ["--noEmit", "--pretty", "false"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
