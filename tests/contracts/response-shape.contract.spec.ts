import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import {
  resolveSchema,
  type JsonSchema,
  type OpenApiDocument,
} from "./contract-schema.js";

type Schema = JsonSchema & {
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
};

type Operation = {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: Schema }> }
  >;
};

type Document = OpenApiDocument & {
  paths: Record<string, Record<string, Operation | undefined>>;
};

const document = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as Document;

const methods = ["get", "post", "put", "patch", "delete"] as const;
const errorStatuses = ["400", "401", "403", "404", "409"] as const;
const primitiveTypes = ["string", "integer", "number", "boolean"];

function responseDataSchema(
  operation: Operation,
  status: string,
): Schema | undefined {
  const schema = operation.responses?.[status]?.content?.["application/json"]
    ?.schema;
  if (!schema) return undefined;
  const wrapper = resolveSchema(document, schema) as Schema;
  return wrapper.properties?.data;
}

function payloads(): Array<[string, string, string, Schema]> {
  const entries: Array<[string, string, string, Schema]> = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of methods) {
      const operation = item[method];
      if (!operation) continue;
      for (const [status, response] of Object.entries(
        operation.responses ?? {},
      )) {
        if (!status.startsWith("2") || status === "204") continue;
        if (!response.content?.["application/json"]) continue;
        const data = responseDataSchema(operation, status);
        if (data) entries.push([method.toUpperCase(), path, status, data]);
      }
    }
  }
  return entries;
}

describe("OpenAPI response shape invariants", () => {
  it("collects successful JSON payloads for every operation", () => {
    expect(payloads().length).toBeGreaterThan(0);
  });

  it.each(payloads())(
    "closes the data payload of %s %s %s",
    (_method, _path, _status, data) => {
      const branches = data.oneOf?.length ? data.oneOf : [data];
      for (const branch of branches) {
        const resolved = resolveSchema(document, branch) as Schema;
        const target =
          resolved.type === "array"
            ? (resolveSchema(
                document,
                resolved.items ?? {},
              ) as Schema)
            : resolved;
        if (target.type === "object") {
          expect(target.additionalProperties).toBe(false);
          for (const key of target.required ?? [])
            expect(target.properties?.[key]).toBeDefined();
        } else {
          expect(primitiveTypes).toContain(target.type);
        }
      }
    },
  );

  it("closes every object component schema", () => {
    const open = Object.entries(document.components.schemas)
      .filter(
        ([, schema]) =>
          schema.type === "object" && schema.additionalProperties !== false,
      )
      .map(([name]) => name);
    expect(open).toEqual([]);
  });

  it("uses ErrorEnvelope for every declared client error response", () => {
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of methods) {
        const operation = item[method];
        if (!operation) continue;
        for (const status of errorStatuses) {
          const response = operation.responses?.[status];
          if (!response) continue;
          expect({
            path,
            method,
            status,
            schema: response.content?.["application/json"]?.schema,
          }).toEqual({
            path,
            method,
            status,
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
          });
        }
      }
    }
  });
});
