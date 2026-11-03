import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { parse } from "yaml";
import { AppModule } from "../../apps/api/src/app.module.js";
import { ContractErrorFilter } from "../../apps/api/src/common/http/error.filter.js";
import { createContractValidationPipe } from "../../apps/api/src/common/http/validation.pipe.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";
import { CatalogService } from "../../apps/api/src/modules/catalog/services/catalog.service.js";
import { AccessGuard } from "../../apps/api/src/modules/identity/access.guard.js";
import { AdminGuard } from "../../apps/api/src/modules/shop/admin.guard.js";
import {
  expectClosedObject,
  resolveSchema,
  type JsonSchema,
  type OpenApiDocument,
} from "./contract-schema.js";

type Schema = JsonSchema & {
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
};

type Operation = {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: Schema }> }
  >;
};

type Document = OpenApiDocument & {
  paths: Record<
    string,
    Partial<Record<"get" | "post" | "patch", Operation>> | undefined
  >;
};

const document = parse(
  readFileSync(
    resolve(process.cwd(), "../../packages/contracts/openapi.yaml"),
    "utf8",
  ),
) as Document;

const CATEGORY_ID = "00000000-0000-4000-8000-000000000301";
const CHILD_ID = "00000000-0000-4000-8000-000000000302";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

const summary = {
  id: CATEGORY_ID,
  parentId: null,
  name: "Home",
  visible: true,
  version: 3,
};
const childSummary = {
  id: CHILD_ID,
  parentId: CATEGORY_ID,
  name: "Kitchen",
  visible: true,
  version: 1,
};
const tree = [
  {
    ...summary,
    children: [{ ...childSummary, children: [] }],
  },
];

function responseDataSchema(
  method: "get" | "post" | "patch",
  path: string,
  status: string,
): Schema {
  const schema =
    document.paths[path]?.[method]?.responses?.[status]?.content[
      "application/json"
    ]?.schema;
  if (!schema) throw new Error(`Missing ${status} schema for ${method} ${path}`);
  const wrapper = resolveSchema(document, schema) as Schema;
  const data = wrapper.properties?.data;
  if (!data) throw new Error(`Missing data schema for ${method} ${path}`);
  return data;
}

function arrayItemSchema(data: Schema): Schema {
  const resolved = resolveSchema(document, data) as Schema;
  if (resolved.type !== "array" || !resolved.items)
    throw new Error("Expected an array data schema");
  return resolved.items as Schema;
}

function publicListBranch(index: number): Schema {
  const data = responseDataSchema("get", "/categories", "200");
  const branch = data.oneOf?.[index];
  if (!branch) throw new Error("Missing /categories data branch");
  return arrayItemSchema(branch);
}

describe("category response contract parity", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ isConfigured: false })
      .overrideProvider(CatalogService)
      .useValue({
        categories: async (_parentId?: string, treeRequested?: boolean) =>
          treeRequested ? tree : [summary, childSummary],
        adminCategories: async () => tree,
        createCategory: async () => summary,
        patchCategory: async () => ({ ...summary, visible: false, version: 4 }),
      })
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
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(createContractValidationPipe());
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
  });

  afterAll(async () => app?.close());

  it("returns flat public categories matching the documented summary", async () => {
    const response = await request(app.getHttpServer()).get("/categories");
    expect(response.status).toBe(200);
    const schema = publicListBranch(0);
    for (const item of response.body.data) {
      expectClosedObject(document, schema, item);
      expect(Object.keys(item).sort()).toEqual(
        ["id", "name", "parentId", "version", "visible"].sort(),
      );
    }
  });

  it("returns recursive public categories matching the documented tree node", async () => {
    const response = await request(app.getHttpServer()).get(
      "/categories?tree=true",
    );
    expect(response.status).toBe(200);
    const schema = publicListBranch(1);
    const root = response.body.data[0];
    expectClosedObject(document, schema, root);
    expect(Object.keys(root).sort()).toEqual(
      ["children", "id", "name", "parentId", "version", "visible"].sort(),
    );
    expectClosedObject(document, schema, root.children[0]);
  });

  it("returns the same closed tree node for the admin list", async () => {
    const response = await request(app.getHttpServer()).get(
      "/admin/categories",
    );
    expect(response.status).toBe(200);
    const itemSchema = arrayItemSchema(
      responseDataSchema("get", "/admin/categories", "200"),
    );
    const root = response.body.data[0];
    expectClosedObject(document, itemSchema, root);
    expect(Object.keys(root).sort()).toEqual(
      ["children", "id", "name", "parentId", "version", "visible"].sort(),
    );
  });

  it.each([
    ["post", "/admin/categories", "201", { name: "Home", parentId: null, visible: true }],
    [
      "patch",
      `/admin/categories/${CATEGORY_ID}`,
      "200",
      { visible: false, expectedVersion: 3 },
    ],
  ] as const)(
    "returns the exact category projection for %s %s",
    async (method, path, status, body) => {
      const agent = request(app.getHttpServer());
      const response =
        method === "post"
          ? await agent.post(path).send(body)
          : await agent.patch(path).send(body);
      expect(response.status).toBe(Number(status));
      const schemaPath =
        method === "patch" ? "/admin/categories/{id}" : path;
      const schema = responseDataSchema(method, schemaPath, status);
      expectClosedObject(document, schema, response.body.data);
      expect(Object.keys(response.body.data).sort()).toEqual(
        ["id", "name", "parentId", "version", "visible"].sort(),
      );
    },
  );
});
