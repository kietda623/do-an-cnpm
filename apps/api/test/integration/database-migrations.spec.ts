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
         AND table_name IN ('addresses', 'assets', 'audit_events', 'idempotency_records', 'sessions', 'users')
       ORDER BY table_name`,
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "addresses",
      "assets",
      "audit_events",
      "idempotency_records",
      "sessions",
      "users",
    ]);

    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name IN ('0001_shared', '0002_identity_assets') AND finished_at IS NOT NULL`,
    );
    expect(before.rows[0]?.count).toBe("2");

    runPrismaMigration("deploy");

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name IN ('0001_shared', '0002_identity_assets') AND finished_at IS NOT NULL`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  }, 120_000);

  it("enforces identity, default-address, asset, and actor foreign-key constraints", async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
       VALUES ('migration-buyer@example.test', 'hash', 'Migration Buyer')
       RETURNING "id"`,
    );
    const userId = user.rows[0]!.id;

    await expect(
      pool.query(
        `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
         VALUES ('Migration-Buyer@example.test', 'hash', 'Not Normalized')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const defaultAddress = (line1: string) =>
      pool.query(
        `INSERT INTO "addresses" (
           "user_id", "recipient_name", "phone", "line1", "ward", "district", "province", "country", "is_default"
         ) VALUES ($1, 'Buyer', '0901234567', $2, 'Ward', 'District', 'Province', 'VN', true)`,
        [userId, line1],
      );
    await defaultAddress("1 Migration Street");
    await expect(defaultAddress("2 Migration Street")).rejects.toMatchObject({ code: "23505" });
    await pool.query(
      `UPDATE "addresses" SET "deleted_at" = CURRENT_TIMESTAMP WHERE "user_id" = $1`,
      [userId],
    );
    await defaultAddress("2 Migration Street");

    const asset = await pool.query<{ id: string }>(
      `INSERT INTO "assets" (
         "uploader_user_id", "purpose", "object_key", "mime_type", "byte_size", "width", "height", "status"
       ) VALUES ($1, 'AVATAR', 'test/migration-avatar.png', 'image/png', 128, 16, 16, 'VERIFIED')
       RETURNING "id"`,
      [userId],
    );
    await pool.query(`UPDATE "users" SET "avatar_asset_id" = $1 WHERE "id" = $2`, [
      asset.rows[0]!.id,
      userId,
    ]);

    await expect(
      pool.query(
        `INSERT INTO "assets" (
           "uploader_user_id", "purpose", "object_key", "mime_type", "byte_size", "width", "height"
         ) VALUES ($1, 'AVATAR', 'test/oversized.png', 'image/png', 5242881, 16, 16)`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await pool.query(
      `INSERT INTO "audit_events" (
         "actor_user_id", "actor_kind", "action", "target_type", "target_id", "outcome", "request_id"
       ) VALUES ($1, 'USER', 'profile.read', 'User', $1, 'SUCCESS', gen_random_uuid())`,
      [userId],
    );
    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" ("actor_user_id", "actor_scope", "operation", "idempotency_key", "request_hash")
         VALUES (gen_random_uuid(), 'user:missing', 'test.operation', 'missing-actor', repeat('a', 64))`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

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
