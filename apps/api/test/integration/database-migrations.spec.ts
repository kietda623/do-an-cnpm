import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import {
  createTestPool,
  resetAndDeployMigrations,
  runPrismaMigration,
} from "../helpers/database.js";
import type { Pool } from "pg";

describe("PostgreSQL shared migrations", () => {
  let pool: Pool;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("applies a fresh migration and remains stable when deploy is repeated", async () => {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('audit_events', 'idempotency_records')
       ORDER BY table_name`,
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "audit_events",
      "idempotency_records",
    ]);

    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name = '0001_shared' AND finished_at IS NOT NULL`,
    );
    expect(before.rows[0]?.count).toBe("1");

    runPrismaMigration("deploy");

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name = '0001_shared' AND finished_at IS NOT NULL`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  }, 120_000);

  it("enforces append-only audit and idempotency uniqueness/state constraints", async () => {
    const audit = await pool.query<{ id: string }>(
      `INSERT INTO "audit_events" (
         "actor_kind", "action", "target_type", "target_id", "outcome", "request_id", "safe_metadata"
       ) VALUES ('SYSTEM', 'test.migration', 'TestResource', gen_random_uuid(), 'SUCCESS', gen_random_uuid(), '{"suite":"integration"}')
       RETURNING "id"`,
    );
    const auditId = audit.rows[0]!.id;

    await expect(
      pool.query(`UPDATE "audit_events" SET "reason" = 'changed' WHERE "id" = $1`, [auditId]),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      pool.query(`DELETE FROM "audit_events" WHERE "id" = $1`, [auditId]),
    ).rejects.toMatchObject({
      code: "55000",
    });
    await expect(pool.query(`TRUNCATE TABLE "audit_events"`)).rejects.toMatchObject({
      code: "55000",
    });
    await expect(
      pool.query(
        `INSERT INTO "audit_events" (
           "actor_kind", "action", "target_type", "target_id", "outcome", "request_id", "safe_metadata"
         ) VALUES ('SYSTEM', 'test.invalid', 'TestResource', gen_random_uuid(), 'SUCCESS', gen_random_uuid(), '[]')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const insertIdempotency = () =>
      pool.query(
        `INSERT INTO "idempotency_records" ("actor_scope", "operation", "idempotency_key", "request_hash")
         VALUES ('job:test', 'test.operation', 'once', repeat('a', 64))`,
      );
    await insertIdempotency();
    await expect(insertIdempotency()).rejects.toMatchObject({ code: "23505" });
    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" (
           "actor_scope", "operation", "idempotency_key", "request_hash", "state"
         ) VALUES ('job:test', 'test.invalid', 'bad-state', repeat('b', 64), 'COMPLETED')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" (
           "actor_scope", "operation", "idempotency_key", "request_hash", "state", "response_status"
         ) VALUES ('job:test', 'test.invalid', 'missing-status', repeat('c', 64), 'COMPLETED', NULL)`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
