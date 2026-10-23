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
};

type Operation = {
  operationId?: string;
  responses?: Record<string, unknown>;
};

type OpenApiDocument = {
  paths: Record<string, Partial<Record<"get" | "post" | "patch" | "delete", Operation>>>;
  components: { schemas: Record<string, Schema> };
};

const contractPath = resolve(process.cwd(), "../../packages/contracts/openapi.yaml");
const contract = parse(readFileSync(contractPath, "utf8")) as OpenApiDocument;
const identityOperations = [
  ["get", "/auth/csrf", "200"],
  ["post", "/auth/register", "201"],
  ["post", "/auth/login", "200"],
  ["post", "/auth/refresh", "200"],
  ["post", "/auth/logout", "204"],
  ["get", "/users/me", "200"],
  ["patch", "/users/me", "200"],
  ["post", "/users/me/password", "204"],
  ["get", "/users/me/addresses", "200"],
  ["post", "/users/me/addresses", "201"],
  ["patch", "/users/me/addresses/{id}", "200"],
  ["delete", "/users/me/addresses/{id}", "204"],
  ["post", "/users/me/assets", "201"],
] as const;

const identityFixtures = [
  {
    schema: "Register",
    value: {
      email: "buyer@example.test",
      password: "correct horse battery staple",
      fullName: "Test Buyer",
      clientPlatform: "WEB",
    },
  },
  {
    schema: "Login",
    value: {
      email: "buyer@example.test",
      password: "correct horse battery staple",
      clientPlatform: "IOS",
    },
  },
  { schema: "Refresh", value: { refreshToken: "opaque-test-token", clientPlatform: "ANDROID" } },
  {
    schema: "PasswordChange",
    value: { currentPassword: "old-password", newPassword: "new password long enough" },
  },
  {
    schema: "AddressWrite",
    value: {
      recipientName: "Test Buyer",
      phone: "0901234567",
      line1: "1 Test Street",
      ward: "Ward 1",
      district: "District 1",
      province: "Ho Chi Minh City",
      country: "VN",
      isDefault: true,
    },
  },
  { schema: "Upload", value: { file: "<binary fixture>", purpose: "AVATAR" } },
] as const;

describe("identity OpenAPI and runtime contract", () => {
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

  it.each(identityOperations)(
    "documents %s %s with success response %s",
    (method, path, status) => {
      const operation = contract.paths[path]?.[method];
      expect(operation?.operationId).toBeTruthy();
      expect(operation?.responses?.[status]).toBeDefined();
    },
  );

  it.each(identityOperations)("exposes %s %s from the Nest runtime", (method, path) => {
    expect(runtimeDocument.paths[path]?.[method]).toBeDefined();
  });

  it.each(identityFixtures)(
    "keeps the %s fixture aligned with its request schema",
    ({ schema, value }) => {
      const requestSchema = contract.components.schemas[schema];
      expect(requestSchema).toBeDefined();
      const properties = requestSchema.properties ?? {};
      for (const field of requestSchema.required ?? []) {
        expect(value).toHaveProperty(field);
      }
      for (const [field, rawValue] of Object.entries(value)) {
        const definition = properties[field];
        expect(definition).toBeDefined();
        if (typeof rawValue === "string" && definition?.enum) {
          expect(definition.enum).toContain(rawValue);
        }
        if (typeof rawValue === "string" && definition?.minLength) {
          expect(rawValue.length).toBeGreaterThanOrEqual(definition.minLength);
        }
        if (typeof rawValue === "string" && definition?.maxLength) {
          expect(rawValue.length).toBeLessThanOrEqual(definition.maxLength);
        }
      }
      expect(requestSchema.additionalProperties).toBe(false);
    },
  );

  it("keeps password and session secrets out of buyer and error DTOs", () => {
    const userProperties = Object.keys(contract.components.schemas.User.properties ?? {});
    expect(userProperties).not.toEqual(
      expect.arrayContaining([
        "password",
        "passwordHash",
        "refreshToken",
        "refreshHash",
        "authVersion",
      ]),
    );
    expect(Object.keys(contract.components.schemas.ErrorEnvelope.properties ?? {})).toEqual([
      "error",
    ]);
    const tokenProperties = Object.keys(contract.components.schemas.Tokens.properties ?? {});
    expect(tokenProperties).not.toEqual(
      expect.arrayContaining(["password", "passwordHash", "refreshHash"]),
    );
  });

  it("declares upload as a single required binary file with only supported image purposes", () => {
    const upload = contract.components.schemas.Upload;
    expect(upload.required).toEqual(expect.arrayContaining(["file", "purpose"]));
    expect(upload.properties?.file).toMatchObject({ type: "string", format: "binary" });
    expect(upload.properties?.purpose?.enum).toEqual([
      "AVATAR",
      "SHOP_LOGO",
      "SHOP_BANNER",
      "PRODUCT_IMAGE",
    ]);
  });
});
