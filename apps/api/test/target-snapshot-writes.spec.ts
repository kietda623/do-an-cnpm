import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import ts from "typescript";

describe("payment target snapshot writes", () => {
  it("routes every TypeScript snapshot property assignment through the builder", () => {
    const violations: string[] = [];
    let writes = 0;
    function scan(path: string) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.name === "generated" || entry.name === "node_modules")
          continue;
        const file = join(path, entry.name);
        if (entry.isDirectory()) {
          scan(file);
          continue;
        }
        if (!/\.tsx?$/.test(file)) continue;
        const source = ts.createSourceFile(
          file,
          readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node: ts.Node) {
          if (
            ts.isPropertyAssignment(node) &&
            node.name.getText(source).replace(/^['"]|['"]$/g, "") ===
              "targetSellerOrdersSnapshot"
          ) {
            writes++;
            if (
              !ts.isCallExpression(node.initializer) ||
              node.initializer.expression.getText(source) !==
                "buildTargetSellerOrdersSnapshot"
            )
              violations.push(file);
          }
          if (
            ts.isShorthandPropertyAssignment(node) &&
            node.name.text === "targetSellerOrdersSnapshot"
          )
            violations.push(file);
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    for (const path of ["src", "prisma/seed", "test", "../../tests"])
      scan(resolve(process.cwd(), path));
    expect(writes).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
});
