import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { parse } from "yaml";
import { AppModule } from "../../apps/api/src/app.module.js";
import { ContractErrorFilter } from "../../apps/api/src/common/http/error.filter.js";
import { createContractValidationPipe } from "../../apps/api/src/common/http/validation.pipe.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";
import { AccessGuard } from "../../apps/api/src/modules/identity/access.guard.js";
import { OrderQueryService } from "../../apps/api/src/modules/order/services/order-query.service.js";
import { ShippingService } from "../../apps/api/src/modules/shipping/services/shipping.service.js";
import {
  expectClosedObject,
  resolveSchema,
  type JsonSchema,
  type OpenApiDocument,
} from "./contract-schema.js";

type Operation = {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: JsonSchema }> }
  >;
};
type Document = OpenApiDocument & {
  paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
};

const document = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as Document;

const ORDER_ID = "00000000-0000-4000-8000-000000000201";
const SHIPMENT_ID = "00000000-0000-4000-8000-000000000202";
const SELLER_ORDER_ID = "00000000-0000-4000-8000-000000000203";
const HISTORY_ID = "00000000-0000-4000-8000-000000000204";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-20T00:00:00.000Z");

const historyEntry = {
  id: HISTORY_ID,
  fromStatus: null,
  toStatus: "FAILED",
  attemptNumber: 1,
  reason: "Recipient unavailable",
  createdAt: NOW,
};

const shipment = {
  id: SHIPMENT_ID,
  sellerOrderId: SELLER_ORDER_ID,
  status: "FAILED",
  trackingCode: "TRACK-0001",
  attemptNumber: 1,
  version: 4,
  history: [historyEntry],
  createdAt: NOW,
  updatedAt: NOW,
};

const order = {
  id: ORDER_ID,
  buyerId: "00000000-0000-4000-8000-000000000010",
  orderNumber: "ORD-0001",
  sellerOrders: [{ id: SELLER_ORDER_ID, status: "CANCELLED" }],
  status: "CANCELLED",
  partiallyCancelled: false,
  originalTotal: "2500",
  cancelledAmount: "2500",
  capturedAmount: "0",
  refundedAmount: "2500",
  outstandingAmount: "0",
  paymentMethod: "MOCK",
  paymentStatus: "REFUNDED",
  currency: "VND",
  payments: [],
  version: 5,
  createdAt: NOW,
  updatedAt: NOW,
};

function dataSchema(path: string): JsonSchema {
  const response = document.paths[path]?.post?.responses?.["200"];
  const schema = response?.content?.["application/json"]?.schema;
  if (!schema) throw new Error(`Missing 200 schema for POST ${path}`);
  const data = resolveSchema(document, schema).properties?.data;
  if (!data) throw new Error(`Missing 200 data schema for POST ${path}`);
  return data;
}

function shipmentHistorySchema(): JsonSchema {
  const shipmentSchema = resolveSchema(document, {
    $ref: "#/components/schemas/Shipment",
  });
  const items = shipmentSchema.properties?.history?.items;
  if (!items) throw new Error("Missing Shipment.history items schema");
  return resolveSchema(document, items);
}

describe("US7 fulfillment response contract parity", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ isConfigured: false })
      .overrideProvider(ShippingService)
      .useValue({
        confirmReturn: async () => ({
          shipment,
          orderId: ORDER_ID,
          replay: true,
        }),
        event: async () => ({ shipment, orderId: ORDER_ID, replay: true }),
        retry: async () => ({ shipment, orderId: ORDER_ID, replay: true }),
      })
      .overrideProvider(OrderQueryService)
      .useValue({ get: async () => order })
      .overrideGuard(AccessGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{ accessContext: unknown }>()
            .accessContext = {
            userId: ADMIN_ID,
            sessionId: ADMIN_ID,
            systemRole: "ADMIN",
            authVersion: 1,
          };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(createContractValidationPipe());
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
  });

  afterAll(async () => app?.close());

  it("declares ActionResult and Shipment for the reviewed routes", () => {
    expect(
      dataSchema("/admin/shipments/{id}/return-confirmation").$ref,
    ).toBe("#/components/schemas/ActionResult");
    expect(dataSchema("/shipments/{id}/events").$ref).toBe(
      "#/components/schemas/Shipment",
    );
    expect(dataSchema("/shipments/{id}/retry").$ref).toBe(
      "#/components/schemas/Shipment",
    );
  });

  it("returns the exact ActionResult shape for return confirmation", async () => {
    const response = await request(app.getHttpServer())
      .post(`/admin/shipments/${SHIPMENT_ID}/return-confirmation`)
      .set("Authorization", "Bearer contract-test")
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Parcel returned", expectedVersion: 4 });
    expect(response.status).toBe(200);
    const schema = dataSchema("/admin/shipments/{id}/return-confirmation");
    expectClosedObject(document, schema, response.body.data);
    const resultingOrder = resolveSchema(document, schema).properties
      ?.resultingOrder;
    expect(resultingOrder).toBeDefined();
    expectClosedObject(
      document,
      resultingOrder!,
      response.body.data.resultingOrder,
    );
    expect(response.body.data.affectedResourceIds).toEqual([SELLER_ORDER_ID]);
    expect(response.body.data.replay).toBe(true);
  });

  it("declares a closed shipment history entry matching the runtime projection", () => {
    const item = shipmentHistorySchema();
    expect(item.type).toBe("object");
    expect(item.additionalProperties).toBe(false);
    expect(Object.keys(item.properties ?? {}).sort()).toEqual(
      [
        "id",
        "fromStatus",
        "toStatus",
        "attemptNumber",
        "reason",
        "createdAt",
      ].sort(),
    );
    expect([...(item.required ?? [])].sort()).toEqual(
      [
        "id",
        "fromStatus",
        "toStatus",
        "attemptNumber",
        "reason",
        "createdAt",
      ].sort(),
    );
  });

  it.each(["/shipments/{id}/events", "/shipments/{id}/retry"])(
    "returns a closed Shipment without replay on POST %s",
    async (path) => {
      const body =
        path.endsWith("/events")
          ? { eventId: randomUUID(), event: "IN_TRANSIT", expectedVersion: 4 }
          : { reason: "Try again", expectedVersion: 4 };
      const response = await request(app.getHttpServer())
        .post(path.replace("{id}", SHIPMENT_ID))
        .set("Authorization", "Bearer contract-test")
        .set("Idempotency-Key", randomUUID())
        .send(body);
      expect(response.status).toBe(200);
      expectClosedObject(document, dataSchema(path), response.body.data);
      expect(response.body.data).not.toHaveProperty("replay");
      for (const entry of response.body.data.history)
        expectClosedObject(document, shipmentHistorySchema(), entry);
    },
  );
});
