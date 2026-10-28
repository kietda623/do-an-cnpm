import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import request from "supertest";
import { AppModule } from "../../apps/api/src/app.module.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";
import { AccessGuard } from "../../apps/api/src/modules/identity/access.guard.js";
import { ShopStatisticsService } from "../../apps/api/src/modules/shop/services/shop-statistics.service.js";
import { createContractValidationPipe } from "../../apps/api/src/common/http/validation.pipe.js";
import { ContractErrorFilter } from "../../apps/api/src/common/http/error.filter.js";

type Operation = {
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
  responses?: Record<string, unknown>;
};
type Paths = Record<string, Partial<Record<"get" | "post", Operation>>>;
const contract = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as { paths: Paths };
const routes = [
  {
    method: "post",
    path: "/reviews",
    private: true,
    filters: [],
    errors: ["400", "401", "404", "409", "422"],
  },
  {
    method: "get",
    path: "/products/{id}/reviews",
    private: false,
    filters: ["rating", "page", "pageSize"],
    errors: ["400", "404"],
  },
  {
    method: "get",
    path: "/shops/{id}/reviews",
    private: true,
    filters: ["productId", "rating", "page", "pageSize"],
    errors: ["400", "401", "404"],
  },
  {
    method: "get",
    path: "/shops/{id}/stats",
    private: true,
    filters: ["from", "to"],
    errors: ["400", "401", "404"],
  },
  {
    method: "get",
    path: "/shops/{id}/revenue",
    private: true,
    filters: ["from", "to", "groupBy"],
    errors: ["400", "401", "404"],
  },
] as const;

describe("US8 reviews and revenue contract parity", () => {
  let app: INestApplication;
  let runtime: Paths;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ isConfigured: false })
      .overrideProvider(ShopStatisticsService)
      .useValue({ stats: async () => ({}), revenue: async () => ({}) })
      .overrideGuard(AccessGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context
            .switchToHttp()
            .getRequest<{ accessContext: { userId: string } }>().accessContext =
            { userId: "00000000-0000-4000-8000-000000000001" };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(createContractValidationPipe());
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
    runtime = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addBearerAuth(
          { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          "BearerAuth",
        )
        .build(),
      { ignoreGlobalPrefix: true },
    ).paths as unknown as Paths;
  });
  afterAll(async () => app?.close());

  it.each(routes)(
    "exposes $method $path with the declared auth, filters and errors",
    ({ method, path, private: isPrivate, filters, errors }) => {
      const declared = contract.paths[path]?.[method];
      const actual = runtime[path]?.[method];
      expect(declared).toBeDefined();
      expect(actual).toBeDefined();
      expect(declared?.security ?? []).toEqual(
        isPrivate ? [{ BearerAuth: [] }] : [],
      );
      expect(actual?.security ?? []).toEqual(
        isPrivate ? [{ BearerAuth: [] }] : [],
      );
      for (const filter of filters) {
        expect(declared?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: filter, in: "query" }),
          ]),
        );
        expect(actual?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: filter, in: "query" }),
          ]),
        );
      }
      for (const status of errors) {
        expect(declared?.responses).toHaveProperty(status);
        expect(actual?.responses).toHaveProperty(status);
      }
    },
  );

  it.each([
    ["/shops/{id}/stats", "from"],
    ["/shops/{id}/stats", "to"],
    ["/shops/{id}/revenue", "from"],
    ["/shops/{id}/revenue", "to"],
    ["/shops/{id}/revenue", "groupBy"],
  ])(
    "requires query %s %s in both OpenAPI and runtime Swagger",
    (path, name) => {
      for (const operation of [contract.paths[path]?.get, runtime[path]?.get]) {
        expect(operation?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name, in: "query", required: true }),
          ]),
        );
      }
    },
  );

  it.each([
    ["stats", "to=2026-11-01T00%3A00%3A00Z", "from"],
    ["stats", "from=2026-10-01T00%3A00%3A00Z", "to"],
    ["stats", "from=not-a-date&to=2026-11-01T00%3A00%3A00Z", "from"],
    ["stats", "from=2026-10-01T00%3A00%3A00Z&to=not-a-date", "to"],
    ["revenue", "to=2026-11-01T00%3A00%3A00Z&groupBy=DAY", "from"],
    ["revenue", "from=2026-10-01T00%3A00%3A00Z&groupBy=DAY", "to"],
    [
      "revenue",
      "from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z",
      "groupBy",
    ],
    [
      "revenue",
      "from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z&groupBy=YEAR",
      "groupBy",
    ],
    [
      "revenue",
      "from=2026-11-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z&groupBy=DAY",
      "to",
    ],
    [
      "stats",
      "from=2026-11-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z",
      "to",
    ],
  ])(
    "returns a field-specific 400 for %s query %s",
    async (endpoint, query, field) => {
      const response = await request(app.getHttpServer())
        .get(`/shops/00000000-0000-4000-8000-000000000002/${endpoint}?${query}`)
        .set("Authorization", "Bearer test");
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    },
  );
});
