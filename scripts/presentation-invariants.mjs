import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

// Independent source-level companion to Hallmark's DOM inventory.
// JSX composition/imports may change; app logic and interactive bindings may not.
const roots = ["apps/storefront/src", "apps/seller-center/src", "apps/admin-panel/src"];
const baselinePath = "docs/testing/cyan-presentation-baseline.json";
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const attributes = /^(on[A-Z].*|href|action|name|id|type|value|defaultValue|checked|defaultChecked|required|min|max|minLength|maxLength|pattern|disabled|data-testid|aria-label|aria-current|aria-selected)$/;

function withoutPresentation(node) {
  const result = ts.transform(node, [context => {
    const visit = current => {
      if (ts.isImportDeclaration(current)) return undefined;
      if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) {
        return ts.factory.createIdentifier("PRESENTATION");
      }
      return ts.visitEachChild(current, visit, context);
    };
    return visit;
  }]);
  const text = printer.printNode(ts.EmitHint.Unspecified, result.transformed[0], node.getSourceFile());
  result.dispose();
  return text;
}

function inspect(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const bindings = [];
  const expressions = [];
  let themeScript;
  const visit = node => {
    if (ts.isJsxAttribute(node) && attributes.test(node.name.getText(source))) {
      bindings.push(withoutPresentation(node));
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      expressions.push(withoutPresentation(node.expression));
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "themeScript") {
      themeScript = withoutPresentation(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    logic: file.endsWith("/layout.tsx") ? digest(themeScript ?? "") : digest(withoutPresentation(source)),
    bindings: bindings.sort(),
    expressions: expressions.sort(),
  };
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(file, files);
    else if (/\.tsx?$/.test(file) && !/\.d\.ts$/.test(file)) files.push(file);
  }
  return files;
}

const current = Object.fromEntries(roots.flatMap(root => walk(root)).sort().map(file => [file, inspect(file)]));
if (process.argv.includes("--record")) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(current).length} source files.`);
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const changed = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].flatMap(file => {
    if (!baseline[file] || !current[file]) return [{ file, reason: "source file added or removed" }];
    return ["logic", "bindings", "expressions"].filter(key => JSON.stringify(baseline[file][key]) !== JSON.stringify(current[file][key])).map(key => ({ file, reason: key }));
  });
  console.log(JSON.stringify({ files: Object.keys(current).length, changes: changed }, null, 2));
  if (changed.length) process.exitCode = 1;
}
