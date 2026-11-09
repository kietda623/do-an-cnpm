import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./write-checksums.mjs", import.meta.url),
);

test("writes a stable SHA256SUMS manifest for every artifact file", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "desktop-checksums-"));
  try {
    writeFileSync(path.join(directory, "Marketplace.dmg"), "world\n");
    writeFileSync(path.join(directory, "Marketplace.msi"), "hello\n");
    const expected =
      "e258d248fda94c63753607f7c4494ee0fcbe92f1a76bfdac795c9d84101eb317  Marketplace.dmg\n" +
      "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03  Marketplace.msi\n";

    const first = spawnSync(process.execPath, [scriptPath, directory], {
      encoding: "utf8",
    });
    assert.equal(first.status, 0, first.stderr);
    assert.equal(
      readFileSync(path.join(directory, "SHA256SUMS"), "utf8"),
      expected,
    );

    const second = spawnSync(process.execPath, [scriptPath, directory], {
      encoding: "utf8",
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      readFileSync(path.join(directory, "SHA256SUMS"), "utf8"),
      expected,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("refuses to write a manifest when the artifact directory is empty", () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "desktop-checksums-empty-"),
  );
  try {
    const result = spawnSync(process.execPath, [scriptPath, directory], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No bundle artifacts found/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
