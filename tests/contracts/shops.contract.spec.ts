import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { parse } from "yaml";
import { AppModule } from "../../apps/api/src/app.module.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";

type Schema = {
  type?: string;
  format?: string;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  nullable?: boolean;
};

type Operation = {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    content?: Record<string, { schema?: { $ref?: string } }>;
  };
  responses?: Record<string, unknown>;
};

type OpenApiDocument = {
  paths: Record<string, Partial<Record<"get" | "post" | "patch", Operation>>>;
  components: { schemas: Record<string, Schema> };
};

const contractPath = resolve(process.cwd(), "../../packages/contracts/openapi.yaml");
const contract = parse(readFileSync(contractPath, "utf8")) as OpenApiDocument;
const shopOperations = [
  ["get", "/users/me/shops", "200", undefined],
  ["post", "/shops", "201", "ShopWrite"],
  ["get", "/shops/{id}", "200", undefined],
  ["patch", "/shops/{id}", "200", "ShopPatch"],
  ["get", "/shops/{id}/management", "200", undefined],
  ["post", "/shops/{id}/resubmit", "200", "ExpectedVersion"],
  ["get", "/admin/shops", "200", undefined],
  ["post", "/admin/shops/{id}/approve", "200", "ExpectedVersion"],
  ["post", "/admin/shops/{id}/reject", "200", "ReasonVersion"],
  ["post", "/admin/shops/{id}/suspend", "200", "ReasonVersion"],
  ["post", "/admin/shops/{id}/resume", "200", "ReasonVersion"],
] as const;

const fixtures = [
  {
    schema: "ShopWrite",
    value: {
      name: "Example Shop",
      slug: "example-shop",
      description: "A shop used by the contract tests.",
      logoAssetId: "00000000-0000-4000-8000-000000000001",
      contactAddress: "1 Test Street, Ward 1",
      phone: "0901234567",
    },
  },
  { schema: "ShopPatch", value: { name: "Updated Shop", expectedVersion: 1 } },
  { schema: "ExpectedVersion", value: { expectedVersion: 0 } },
  {
    schema: "ReasonVersion",
    value: { reason: "Business documents need correction.", expectedVersion: 0 },
  },
] as const;

describe("shop OpenAPI and runtime contract", () => {
  let app: INestApplication;
  let runtimeDocument: ReturnType<typeof SwaggerModule.createDocument>;

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
    runtimeDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Marketplace API").setVersion("1.0.0").build(),
      { ignoreGlobalPrefix: true },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each(shopOperations)("documents %s %s with success response %s", (method, path, status) => {
    const operation = contract.paths[path]?.[method];
    expect(operation?.operationId).toBeTruthy();
    expect(operation?.responses?.[status]).toBeDefined();
  });

  it.each(shopOperations)("exposes %s %s from the Nest runtime", (method, path) => {
    expect(runtimeDocument.paths[path]?.[method]).toBeDefined();
  });

  it.each(shopOperations)(
    "uses the declared request schema for %s %s",
    (method, path, _status, schema) => {
      const operation = contract.paths[path]?.[method];
      if (!schema) {
        expect(operation?.requestBody).toBeUndefined();
        return;
      }
      expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
        `#/components/schemas/${schema}`,
      );
    },
  );

  it.each(fixtures)("keeps the %s fixture aligned with its schema", ({ schema, value }) => {
    const requestSchema = contract.components.schemas[schema];
    expect(requestSchema?.additionalProperties).toBe(false);
    for (const field of requestSchema.required ?? []) expect(value).toHaveProperty(field);
    for (const [field, rawValue] of Object.entries(value)) {
      const definition = requestSchema.properties?.[field];
      expect(definition).toBeDefined();
      if (typeof rawValue === "string") {
        if (definition?.minLength)
          expect(rawValue.length).toBeGreaterThanOrEqual(definition.minLength);
        if (definition?.maxLength)
          expect(rawValue.length).toBeLessThanOrEqual(definition.maxLength);
        if (definition?.enum) expect(definition.enum).toContain(rawValue);
      }
    }
  });

  it("requires expectedVersion on shop writes and excludes private fields from the public projection", () => {
    expect(contract.components.schemas.ShopPatch.required).toContain("expectedVersion");
    const publicProperties = Object.keys(contract.components.schemas.ShopPublic.properties ?? {});
    expect(publicProperties).toEqual(
      expect.arrayContaining(["id", "name", "slug", "description", "logo"]),
    );
    expect(publicProperties).not.toEqual(
      expect.arrayContaining([
        "ownerUserId",
        "contactAddress",
        "phone",
        "rejectionReason",
        "version",
      ]),
    );
  });

  it("allows anonymous access only for the public shop read", () => {
    for (const [method, path] of shopOperations) {
      const operation = contract.paths[path]?.[method];
      if (method === "get" && path === "/shops/{id}") {
        expect(operation?.security ?? []).toEqual([]);
      } else {
        expect(operation?.security).toEqual([{ BearerAuth: [] }]);
      }
    }
  });
});
