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

type Operation = {
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
};
type Contract = {
  paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
};
const contract = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as Contract;
const routes = [
  ["get", "/shops/{shopId}/orders"],
  ["get", "/shops/{shopId}/orders/{id}"],
  ["post", "/shops/{shopId}/orders/{id}/confirm"],
  ["post", "/shops/{shopId}/orders/{id}/pack"],
  ["post", "/orders/{id}/seller-orders/{sellerOrderId}/receive"],
  ["get", "/shipments/{id}"],
  ["post", "/shipments/{id}/events"],
  ["post", "/shipments/{id}/retry"],
  ["post", "/admin/seller-orders/{id}/confirm"],
  ["post", "/admin/seller-orders/{id}/pack"],
  ["post", "/admin/shipments/{id}/return-confirmation"],
] as const;

describe("US7 fulfillment contract", () => {
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
      new DocumentBuilder()
        .setTitle("Marketplace API")
        .setVersion("1.0.0")
        .build(),
      { ignoreGlobalPrefix: true },
    );
  });
  afterAll(async () => app?.close());

  it.each(routes)("exposes %s %s with authenticated access", (method, path) => {
    expect(contract.paths[path]?.[method]?.security).toEqual([
      { BearerAuth: [] },
    ]);
    expect(runtime.paths[path]?.[method]).toBeDefined();
  });

  it.each(routes.filter(([method]) => method === "post"))(
    "requires Idempotency-Key for %s %s",
    (_, path) => {
      const key = contract.paths[path]?.post?.parameters?.find(
        (parameter) => parameter.name === "Idempotency-Key",
      );
      expect(key).toMatchObject({ in: "header", required: true });
    },
  );
});
