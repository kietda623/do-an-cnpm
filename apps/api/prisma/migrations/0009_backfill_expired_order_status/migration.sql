-- One-off repair for expired MOCK orders whose seller parts were cancelled by the
-- expiry sweep but whose persisted aggregate status was left PENDING (finding C1).
-- Idempotent: rows already CANCELLED, not expired, holding a successful normal
-- attempt, or still owning a non-cancelled seller order are never matched again.

UPDATE "marketplace_orders" AS mo
SET "status" = 'CANCELLED',
    "version" = mo."version" + 1,
    "updated_at" = clock_timestamp()
WHERE mo."status" <> 'CANCELLED'
  AND mo."payment_method" = 'MOCK'
  AND mo."payment_deadline" IS NOT NULL
  AND mo."payment_deadline" <= clock_timestamp()
  AND NOT EXISTS (
    SELECT 1
    FROM "seller_orders" so
    WHERE so."order_id" = mo."id"
      AND so."status" <> 'CANCELLED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "payments" p
    JOIN "payment_attempts" pa ON pa."payment_id" = p."id"
    WHERE p."order_id" = mo."id"
      AND pa."settlement_kind" = 'NORMAL'
      AND pa."status" = 'SUCCEEDED'
  );
