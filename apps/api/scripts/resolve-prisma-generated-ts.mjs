import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
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
    if (!parentPath.includes(resolvePath("src/generated/prisma"))) throw error;

    const typescriptPath = resolvePath(dirname(parentPath), `${specifier.slice(0, -3)}.ts`);
    if (!existsSync(typescriptPath)) throw error;

    return { url: pathToFileURL(typescriptPath).href, shortCircuit: true };
  }
}
