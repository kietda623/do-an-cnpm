import { existsSync } from "node:fs";
import { dirname, relative, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      !specifier.startsWith(".") ||
      !specifier.endsWith(".js") ||
      !context.parentURL?.startsWith("file:")
    ) {
      throw error;
    }

    const parentPath = fileURLToPath(context.parentURL);
    const apiRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
    const parentIsGeneratedPrisma = parentPath.startsWith(
      resolvePath(apiRoot, "src/generated/prisma") + sep,
    );
    const parentIsSeed = parentPath.startsWith(
      resolvePath(apiRoot, "prisma/seed") + sep,
    );
    if (!parentIsGeneratedPrisma && !parentIsSeed) throw error;

    const typescriptPath = resolvePath(
      dirname(parentPath),
      `${specifier.slice(0, -3)}.ts`,
    );
    if (!existsSync(typescriptPath)) throw error;

    const targetRoots = [
      resolvePath(apiRoot, "src"),
      resolvePath(apiRoot, "prisma/seed"),
    ];
    const targetIsAllowed = targetRoots.some((root) => {
      const relativeTarget = relative(root, typescriptPath);
      return (
        relativeTarget !== "" &&
        relativeTarget !== ".." &&
        !relativeTarget.startsWith(`..${sep}`) &&
        !relativeTarget.startsWith(`..\u002f`) &&
        !relativeTarget.startsWith(`..\\`)
      );
    });
    if (!targetIsAllowed) throw error;

    return { url: pathToFileURL(typescriptPath).href, shortCircuit: true };
  }
}
