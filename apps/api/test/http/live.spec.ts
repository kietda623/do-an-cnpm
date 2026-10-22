import { afterAll, beforeAll, describe, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import request from "supertest";

describe("HTTP application smoke", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // This endpoint does not access persistence; database integrity tests use real PostgreSQL.
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it("serves liveness over HTTP", async () => {
    await request(app.getHttpServer()).get("/health/live").expect(200).expect({ status: "ok" });
  });
});
