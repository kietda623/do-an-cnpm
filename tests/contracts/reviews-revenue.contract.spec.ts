import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
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
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
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
});
