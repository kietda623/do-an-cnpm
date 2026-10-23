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
  properties?: Record<string, Schema>;
  items?: Schema;
  $ref?: string;
  enum?: unknown[];
  maximum?: number;
  minimum?: number;
  pattern?: string;
};
type Operation = {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; schema?: Schema }>;
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
};
type Contract = {
  paths: Record<string, Partial<Record<"get", Operation>>>;
  components: { schemas: Record<string, Schema> };
};

const contract = parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/openapi.yaml"), "utf8"),
) as Contract;
const publicReads = [
  ["get", "/categories"],
  ["get", "/products"],
  ["get", "/products/{id}"],
  ["get", "/shops/{id}"],
  ["get", "/shops/{id}/products"],
] as const;

describe("public discovery OpenAPI/runtime contract", () => {
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

  it.each(publicReads)("documents %s %s as an anonymous read", (method, path) => {
    expect(contract.paths[path]?.[method]?.operationId).toBeTruthy();
    expect(contract.paths[path]?.[method]?.responses?.["200"]).toBeDefined();
    expect(contract.paths[path]?.[method]?.security ?? []).toEqual([]);
    expect(runtime.paths[path]?.[method]).toBeDefined();
  });

  it("whitelists discovery filters and bounds pagination", () => {
    const query = contract.paths["/products"]?.get?.parameters ?? [];
    expect(
      query
        .filter((p) => p.in === "query")
        .map((p) => p.name)
        .sort(),
    ).toEqual(
      ["q", "categoryId", "shopId", "minPrice", "maxPrice", "sort", "page", "pageSize"].sort(),
    );
    const sort = query.find((p) => p.name === "sort")?.schema?.enum;
    expect(sort).toEqual(["PRICE_ASC", "PRICE_DESC", "NEWEST"]);
    expect(query.find((p) => p.name === "pageSize")?.schema).toMatchObject({
      minimum: 1,
      maximum: 100,
    });
    expect(
      contract.paths["/shops/{id}/products"]?.get?.parameters?.map((p) => p.name).sort(),
    ).toEqual(["id", "q", "categoryId", "minPrice", "maxPrice", "sort", "page", "pageSize"].sort());
    const runtimeListParams = (runtime.paths["/products"]?.get?.parameters ?? []).map(
      (p) => p.name,
    );
    expect(runtimeListParams.sort()).toEqual(
      ["q", "categoryId", "shopId", "minPrice", "maxPrice", "sort", "page", "pageSize"].sort(),
    );
    expect(runtime.paths["/products"]?.get?.security ?? []).toEqual([]);
  });

  it("keeps public projections free of moderation, ownership, and contact data", () => {
    const forbidden = [
      "adminHidden",
      "hiddenReason",
      "saleStatus",
      "version",
      "ownerUserId",
      "contactAddress",
      "phone",
      "rejectionReason",
    ];
    const publicSchemas = ["DiscoveryProduct", "ProductPublic", "ProductSummary", "ShopPublic"];
    for (const schemaName of publicSchemas) {
      const properties = contract.components.schemas[schemaName]?.properties ?? {};
      expect(Object.keys(properties)).not.toEqual(expect.arrayContaining(forbidden));
    }
    expect(contract.components.schemas.ProductSummary?.properties?.minimumPrice).toMatchObject({
      type: "string",
      pattern: "^[0-9]+$",
    });
  });
});
