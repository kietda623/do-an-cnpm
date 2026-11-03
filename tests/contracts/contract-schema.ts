import { expect } from "@jest/globals";

export type JsonSchema = {
  $ref?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
};

export type OpenApiDocument = {
  components: { schemas: Record<string, JsonSchema> };
};

const schemaPrefix = "#/components/schemas/";

/** Resolves a local component reference, guarding against reference cycles. */
export function resolveSchema(
  document: OpenApiDocument,
  schema: JsonSchema,
): JsonSchema {
  let current = schema;
  const seen = new Set<string>();
  while (current.$ref) {
    const reference = current.$ref;
    if (seen.has(reference))
      throw new Error(`Circular schema reference: ${reference}`);
    seen.add(reference);
    if (!reference.startsWith(schemaPrefix))
      throw new Error(`Unsupported schema reference: ${reference}`);
    const resolved = document.components.schemas[reference.slice(schemaPrefix.length)];
    if (!resolved) throw new Error(`Missing schema: ${reference}`);
    current = resolved;
  }
  return current;
}

/** Asserts that a runtime payload satisfies a closed object schema. */
export function expectClosedObject(
  document: OpenApiDocument,
  schema: JsonSchema,
  value: unknown,
): void {
  const resolved = resolveSchema(document, schema);
  expect(resolved.type).toBe("object");
  expect(resolved.additionalProperties).toBe(false);
  expect(value).toBeTruthy();
  expect(Array.isArray(value)).toBe(false);
  expect(typeof value).toBe("object");
  const record = value as Record<string, unknown>;
  for (const key of resolved.required ?? []) {
    expect(record).toHaveProperty(key);
  }
  for (const key of Object.keys(record)) {
    expect(resolved.properties?.[key]).toBeDefined();
  }
}
