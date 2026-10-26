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
  format?: string;
  pattern?: string;
  type?: string;
};
type Operation = {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: Schema }>;
  responses?: Record<string, unknown>;
};
type Contract = {
  paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
  components: { schemas: Record<string, Schema> };
};
const contract = parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/openapi.yaml"), "utf8"),
) as Contract;
const operations = [
  ["get", "/payments"],
  ["post", "/payments/mock-attempts"],
  ["post", "/payments/{id}/mock-result"],
  ["post", "/payments/seller-orders/{id}/cod-collection"],
  ["post", "/orders/{id}/cancel"],
  ["post", "/orders/{id}/seller-orders/{sellerOrderId}/cancel"],
  ["post", "/shops/{shopId}/orders/{id}/reject"],
  ["post", "/admin/seller-orders/{id}/reject"],
] as const;

describe("payment and cancellation OpenAPI/runtime contract", () => {
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

  it.each(operations)("documents %s %s in the runtime and contract", (method, path) => {
    const operation = contract.paths[path]?.[method];
    expect(operation?.operationId).toBeTruthy();
    expect(operation?.security).toEqual([{ BearerAuth: [] }]);
    expect(runtime.paths[path]?.[method]).toBeDefined();
  });

  it.each(operations.filter(([method]) => method === "post"))(
    "requires a UUID Idempotency-Key for %s %s",
    (_, path) => {
      const key = contract.paths[path]?.post?.parameters?.find(
        (parameter) => parameter.name === "Idempotency-Key",
      );
      expect(key).toMatchObject({
        in: "header",
        required: true,
        schema: { type: "string", format: "uuid" },
      });
    },
  );

  it("keeps every payment amount an integer VND string and limits settlement outcomes", () => {
    const payment = contract.components.schemas.Payment.properties ?? {};
    expect(payment.amount).toMatchObject({ type: "string", pattern: "^[0-9]+$" });
    for (const field of ["amount"]) expect(payment[field]?.pattern).toBe("^[0-9]+$");
    expect(contract.components.schemas.MockResult.properties?.outcome?.enum).toEqual([
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
    ]);
    expect(contract.components.schemas.ReasonVersion.properties).toEqual(
      expect.objectContaining({
        reason: expect.objectContaining({ type: "string" }),
        expectedVersion: expect.objectContaining({ type: "integer" }),
      }),
    );
  });
});
