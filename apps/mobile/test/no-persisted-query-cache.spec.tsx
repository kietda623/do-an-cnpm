import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
          ? sourceFiles(path)
          : /\.tsx?$/.test(entry.name)
            ? readFile(path, "utf8")
            : Promise.resolve("");
      }),
    )
  ).filter(Boolean);
}

test("mobile query cache has no persistent package, adapter, or SecureStore backend", async () => {
  const appRoot = join(__dirname, "..");
  const manifest = JSON.parse(
    await readFile(join(appRoot, "package.json"), "utf8"),
  ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  });
  expect(
    dependencies.filter((name) =>
      /persist-client|storage-persister|async-storage|mmkv/i.test(name),
    ),
  ).toEqual([]);

  const source = (await sourceFiles(join(appRoot, "src"))).join("\n");
  expect(source).not.toMatch(
    /persistQueryClient|createAsyncStoragePersister|createSyncStoragePersister|AsyncStorage|\bMMKV\b/,
  );
  const queryClientPath = join(appRoot, "src", "features", "api", "query-client.ts");
  if (existsSync(queryClientPath)) {
    const queryClientSource = await readFile(queryClientPath, "utf8");
    expect(queryClientSource).not.toMatch(/SecureStore|expo-secure-store/);
  }
});
