import { describe, expect, it } from "@jest/globals";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { resolve as resolveSeedModule } from "../scripts/resolve-prisma-generated-ts.mjs";

describe("TypeScript seed module resolver", () => {
  it("resolves NodeNext .js specifiers to TypeScript files within seed and API source roots", async () => {
    const parentURL = pathToFileURL(
      resolvePath(process.cwd(), "prisma/seed/demo-seed.ts"),
    ).href;
    const unresolved = new Error("module not found");

    await expect(
      resolveSeedModule("./demo-fixtures.js", { parentURL }, async () => {
        throw unresolved;
      }),
    ).resolves.toEqual({
      url: pathToFileURL(
        resolvePath(process.cwd(), "prisma/seed/demo-fixtures.ts"),
      ).href,
      shortCircuit: true,
    });
  });

  it("keeps resolution failures for missing seed TypeScript modules", async () => {
    const parentURL = pathToFileURL(
      resolvePath(process.cwd(), "prisma/seed/demo-seed.ts"),
    ).href;
    const unresolved = new Error("module not found");

    await expect(
      resolveSeedModule("./missing-demo-module.js", { parentURL }, async () => {
        throw unresolved;
      }),
    ).rejects.toBe(unresolved);
  });

  it("does not map seed imports to TypeScript files outside the allowed roots", async () => {
    const parentURL = pathToFileURL(
      resolvePath(process.cwd(), "prisma/seed/demo-seed.ts"),
    ).href;
    const unresolved = new Error("module not found");

    await expect(
      resolveSeedModule(
        "../../test/demo-seed-plan.spec.js",
        { parentURL },
        async () => {
          throw unresolved;
        },
      ),
    ).rejects.toBe(unresolved);
  });

  it("does not map .js imports from non-seed, non-generated modules", async () => {
    const parentURL = pathToFileURL(
      resolvePath(process.cwd(), "test/demo-seed-plan.spec.ts"),
    ).href;
    const unresolved = new Error("module not found");

    await expect(
      resolveSeedModule(
        "../prisma/seed/demo-fixtures.js",
        { parentURL },
        async () => {
          throw unresolved;
        },
      ),
    ).rejects.toBe(unresolved);
  });
});
