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
  components: {
    schemas: Record<
      string,
      { properties?: Record<string, unknown>; required?: string[] }
    >;
  };
};

const contract = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as Contract;
const adminRoutes = [
  ["get", "/admin/users"],
  ["post", "/admin/users/{id}/lock"],
  ["post", "/admin/users/{id}/unlock"],
  ["get", "/admin/products"],
  ["post", "/admin/products/{id}/hide"],
  ["get", "/admin/orders"],
  ["get", "/admin/orders/{id}"],
  ["get", "/admin/stats"],
  ["get", "/admin/audit"],
] as const;
const idempotentAdminWrites = [
  ...adminRoutes.filter(([method]) => method === "post"),
  ["post", "/admin/seller-orders/{id}/confirm"],
  ["post", "/admin/seller-orders/{id}/pack"],
  ["post", "/admin/seller-orders/{id}/reject"],
] as const;
const adminRecoveryRoutes = [
  ["post", "/admin/seller-orders/{id}/confirm"],
  ["post", "/admin/seller-orders/{id}/pack"],
  ["post", "/admin/seller-orders/{id}/reject"],
] as const;

describe("US9 Admin contract and runtime parity", () => {
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
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          "BearerAuth",
        )
        .build(),
      { ignoreGlobalPrefix: true },
    );
  });

  afterAll(async () => app?.close());

  it.each(adminRoutes)(
    "documents and exposes %s %s for Admin",
    (method, path) => {
      expect(contract.paths[path]?.[method]?.security).toEqual([
        { BearerAuth: [] },
      ]);
      expect(runtime.paths[path]?.[method]).toBeDefined();
      expect(runtime.paths[path]?.[method]?.security).toEqual([
        { BearerAuth: [] },
      ]);
    },
  );

  it.each(adminRecoveryRoutes)(
    "keeps explicit Admin recovery protected for %s %s",
    (method, path) => {
      expect(contract.paths[path]?.[method]?.security).toEqual([
        { BearerAuth: [] },
      ]);
      expect(runtime.paths[path]?.[method]).toBeDefined();
      expect(runtime.paths[path]?.[method]?.security).toEqual([
        { BearerAuth: [] },
      ]);
    },
  );

  it.each(idempotentAdminWrites)(
    "requires Idempotency-Key for %s %s",
    (method, path) => {
      const contractKey = contract.paths[path]?.[method]?.parameters?.find(
        (parameter) => parameter.name === "Idempotency-Key",
      );
      const runtimeKey = runtime.paths[path]?.[method]?.parameters?.find(
        (parameter) => parameter.name === "Idempotency-Key",
      );
      expect(contractKey).toMatchObject({ in: "header", required: true });
      expect(runtimeKey).toMatchObject({ in: "header", required: true });
    },
  );

  it("keeps the Admin User projection versioned and free of credentials", () => {
    const user = contract.components.schemas.User;
    expect(user.required).toContain("version");
    expect(user.properties).toHaveProperty("status");
    expect(user.properties).not.toHaveProperty("passwordHash");
    expect(user.properties).not.toHaveProperty("refreshHash");
    expect(user.properties).not.toHaveProperty("sessionSecret");
  });
});
