import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { AppModule } from "../../apps/api/src/app.module.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";

type Schema = {
  type?: string;
  format?: string;
  enum?: unknown[];
  pattern?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  nullable?: boolean;
  items?: Schema;
  $ref?: string;
};
type Operation = {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: { required?: boolean; content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, unknown>;
};
type Contract = {
  paths: Record<string, Partial<Record<"get" | "post" | "patch", Operation>>>;
  components: { schemas: Record<string, Schema> };
};

const document = parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/openapi.yaml"), "utf8"),
) as Contract;
const operations = [
  ["get", "/categories", "200", undefined],
  ["get", "/admin/categories", "200", undefined],
  ["post", "/admin/categories", "201", "CategoryWrite"],
  ["patch", "/admin/categories/{id}", "200", "CategoryPatch"],
  ["get", "/products", "200", undefined],
  ["get", "/products/{id}", "200", undefined],
  ["get", "/shops/{shopId}/management/products", "200", undefined],
  ["post", "/shops/{shopId}/products", "201", "ProductCreate"],
  ["get", "/shops/{shopId}/products/{id}/management", "200", undefined],
  ["patch", "/shops/{shopId}/products/{id}", "200", "ProductPatch"],
  ["post", "/shops/{shopId}/products/{id}/variants", "201", "VariantCreate"],
  ["patch", "/shops/{shopId}/variants/{id}", "200", "VariantPatch"],
  ["get", "/shops/{shopId}/variants/{id}/inventory", "200", undefined],
  ["post", "/shops/{shopId}/variants/{id}/inventory-adjustments", "200", "InventoryAdjust"],
  ["post", "/users/me/assets", "201", "Upload"],
] as const;

const fixtures = [
  { schema: "CategoryWrite", value: { name: "Home & Living", parentId: null, visible: true } },
  { schema: "CategoryPatch", value: { visible: false, expectedVersion: 2 } },
  { schema: "ProductPatch", value: { selling: false, expectedVersion: 1 } },
  {
    schema: "ProductCreate",
    value: {
      name: "Cotton Shirt",
      description: "Soft cotton.",
      categoryId: "00000000-0000-4000-8000-000000000001",
      imageAssetIds: ["00000000-0000-4000-8000-000000000002"],
      selling: true,
      variants: [
        { sku: "SHIRT-S", attributes: { size: "S" }, price: "150000", stock: 5, selling: true },
      ],
    },
  },
  { schema: "VariantPatch", value: { price: "160000", selling: true, expectedVersion: 1 } },
  { schema: "InventoryAdjust", value: { delta: -1, reason: "Damaged item", expectedVersion: 3 } },
];

describe("catalog and inventory OpenAPI/runtime contracts", () => {
  let app: INestApplication;
  let runtime: ReturnType<typeof SwaggerModule.createDocument>;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ isConfigured: false })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api/v1", {
      exclude: [
        { path: "health/live", method: RequestMethod.GET },
        { path: "health/ready", method: RequestMethod.GET },
      ],
    });
    await app.init();
    runtime = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Marketplace API").setVersion("1.0.0").build(),
      { ignoreGlobalPrefix: true },
    );
  });
  afterAll(async () => app?.close());

  it.each(operations)("documents %s %s with response %s", (method, path, status) => {
    expect(document.paths[path]?.[method]?.operationId).toBeTruthy();
    expect(document.paths[path]?.[method]?.responses?.[status]).toBeDefined();
  });
  it.each(operations)("registers %s %s in the Nest runtime", (method, path) => {
    expect(runtime.paths[path]?.[method]).toBeDefined();
  });
  it.each(operations)("uses declared request schema on %s %s", (method, path, _status, schema) => {
    const operation = document.paths[path]?.[method];
    if (!schema) {
      expect(operation?.requestBody).toBeUndefined();
      return;
    }
    expect(operation?.requestBody?.required).toBe(true);
    expect(
      operation?.requestBody?.content?.[
        schema === "Upload" ? "multipart/form-data" : "application/json"
      ]?.schema?.$ref,
    ).toBe(`#/components/schemas/${schema}`);
  });
  it.each(fixtures)("keeps %s example within the closed request schema", ({ schema, value }) => {
    const shape = document.components.schemas[schema];
    expect(shape.additionalProperties).toBe(false);
    for (const required of shape.required ?? []) expect(value).toHaveProperty(required);
    for (const key of Object.keys(value)) expect(shape.properties?.[key]).toBeDefined();
  });
  it("keeps public product fields separate from management state and prices as integer strings", () => {
    const publicFields = Object.keys(document.components.schemas.ProductPublic.properties ?? {});
    expect(publicFields).toEqual(
      expect.arrayContaining(["id", "shopId", "name", "minimumPrice", "variants"]),
    );
    expect(publicFields).not.toEqual(
      expect.arrayContaining(["adminHidden", "hiddenReason", "version"]),
    );
    expect(document.components.schemas.Variant.properties?.price.pattern).toBe("^[0-9]+$");
  });
  it.each(["CategoryPatch", "ProductPatch", "VariantPatch"])(
    "requires optimistic version on %s",
    (schema) => {
      expect(document.components.schemas[schema]?.required).toContain("expectedVersion");
    },
  );
  it("requires bearer auth for writes and leaves public catalog/category reads anonymous", () => {
    for (const [method, path] of operations) {
      const op = document.paths[path]?.[method];
      const isPublic =
        method === "get" && ["/categories", "/products", "/products/{id}"].includes(path);
      expect(isPublic ? (op?.security ?? []) : op?.security).toEqual(
        isPublic ? [] : [{ BearerAuth: [] }],
      );
    }
  });
});
