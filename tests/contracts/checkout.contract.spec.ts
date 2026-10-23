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
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  format?: string;
  pattern?: string;
};
type Operation = {
  operationId?: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: Schema }>;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
};
type Contract = {
  paths: Record<string, Partial<Record<"get" | "post" | "patch" | "delete", Operation>>>;
  components: { schemas: Record<string, Schema> };
};

const contract = parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/openapi.yaml"), "utf8"),
) as Contract;
const operations = [
  ["get", "/cart"],
  ["post", "/cart/items"],
  ["patch", "/cart/items/{id}"],
  ["delete", "/cart/items/{id}"],
  ["post", "/checkout/quotes"],
  ["post", "/checkout"],
  ["get", "/orders"],
  ["get", "/orders/{id}"],
] as const;

describe("checkout OpenAPI/runtime contract", () => {
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

  it.each(operations)("documents %s %s as an authenticated operation", (method, path) => {
    const operation = contract.paths[path]?.[method];
    expect(operation?.operationId).toBeTruthy();
    expect(
      operation?.responses?.[method === "delete" ? "204" : method === "post" ? "201" : "200"],
    ).toBeDefined();
    expect(operation?.security).toEqual([{ BearerAuth: [] }]);
    expect(runtime.paths[path]?.[method]).toBeDefined();
  });

  it("bounds cart and quote input and requires a UUID idempotency key for checkout", () => {
    const cartAdd = contract.components.schemas.CartAdd.properties ?? {};
    expect(cartAdd.quantity).toMatchObject({ minimum: 1, maximum: 999 });
    expect(contract.components.schemas.CheckoutQuoteRequest.properties?.cartItemIds).toMatchObject({
      minItems: 1,
      maxItems: 100,
    });
    const key = contract.paths["/checkout"]?.post?.parameters?.find(
      (parameter) => parameter.name === "Idempotency-Key",
    );
    expect(key).toMatchObject({
      in: "header",
      required: true,
      schema: { type: "string", format: "uuid" },
    });
    expect(contract.components.schemas.CheckoutCreate.properties?.quoteId).toMatchObject({
      type: "string",
      format: "uuid",
    });
  });

  it("keeps quote and order money as integer VND strings", () => {
    for (const schemaName of ["QuoteLine", "CheckoutQuote", "OrderItem", "SellerOrder", "Order"]) {
      for (const [propertyName, property] of Object.entries(
        contract.components.schemas[schemaName]?.properties ?? {},
      )) {
        if (/total|amount|price|subtotal|shipping/i.test(propertyName)) {
          expect(property).toMatchObject({ type: "string", pattern: "^[0-9]+$" });
        }
      }
    }
  });

  it("exposes the cart, quote, seller split, and immutable order snapshot fields", () => {
    const fields = (name: string) =>
      Object.keys(contract.components.schemas[name]?.properties ?? {}).sort();
    expect(fields("CartItem")).toEqual(
      expect.arrayContaining([
        "id",
        "variantId",
        "productId",
        "productName",
        "currentUnitPrice",
        "quantity",
        "selected",
        "availableQuantity",
        "purchasable",
      ]),
    );
    expect(fields("CheckoutQuote")).toEqual(
      expect.arrayContaining(["quoteId", "expiresAt", "lines", "groups", "total", "valid"]),
    );
    expect(fields("SellerOrder")).toEqual(
      expect.arrayContaining(["shopId", "shopNameSnapshot", "status", "items", "originalTotal"]),
    );
    expect(fields("AddressSnapshot")).toEqual(
      expect.arrayContaining([
        "recipientName",
        "phone",
        "line1",
        "ward",
        "district",
        "province",
        "country",
        "postalCode",
      ]),
    );
    expect(fields("Order")).toEqual(
      expect.arrayContaining([
        "orderNumber",
        "sellerOrders",
        "paymentMethod",
        "paymentStatus",
        "originalTotal",
      ]),
    );
  });
});
