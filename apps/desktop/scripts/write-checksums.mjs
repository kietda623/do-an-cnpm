import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifestName = "SHA256SUMS";

function compareNames(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function listArtifacts(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const unexpected = entries.find(
    (entry) => entry.name !== manifestName && !entry.isFile(),
  );
  if (unexpected) {
    throw new Error(`Expected regular bundle files only: ${unexpected.name}`);
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name !== manifestName)
    .map((entry) => entry.name)
    .sort(compareNames);
  if (names.length === 0) {
    throw new Error(`No bundle artifacts found in ${directory}`);
  }
  if (names.some((name) => name.includes("\n") || name.includes("\r"))) {
    throw new Error("Bundle artifact filenames must not contain line breaks");
  }
  return names;
}

function digestFile(directory, name) {
  return createHash("sha256")
    .update(readFileSync(path.join(directory, name)))
    .digest("hex");
}

function createManifest(directory) {
  return `${listArtifacts(directory)
    .map((name) => `${digestFile(directory, name)}  ${name}`)
    .join("\n")}\n`;
}

export function writeChecksums(directory) {
  const resolvedDirectory = path.resolve(directory);
  const manifestPath = path.join(resolvedDirectory, manifestName);
  const manifest = createManifest(resolvedDirectory);
  writeFileSync(manifestPath, manifest, "utf8");

  if (createManifest(resolvedDirectory) !== manifest) {
    throw new Error("Bundle contents changed while writing SHA256SUMS");
  }
  return manifest;
}

function main() {
  const [directory, ...extraArguments] = process.argv.slice(2);
  if (!directory || extraArguments.length > 0) {
    throw new Error("Usage: node write-checksums.mjs <bundle-directory>");
  }
  writeChecksums(directory);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
