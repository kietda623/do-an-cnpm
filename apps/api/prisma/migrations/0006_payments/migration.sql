CREATE TYPE "payment_provider" AS ENUM ('MOCK', 'COD_SIMULATION');
CREATE TYPE "payment_attempt_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "payment_settlement_kind" AS ENUM ('NORMAL', 'LATE_COMPENSATION');
CREATE TYPE "payment_allocation_kind" AS ENUM ('MOCK_PREPAYMENT', 'COD_COLLECTION');
CREATE TYPE "payment_event_result" AS ENUM ('APPLIED', 'DUPLICATE', 'IGNORED', 'REFUNDED');
CREATE TYPE "payment_observed_status" AS ENUM ('SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "simulated_refund_reason" AS ENUM ('CANCELLATION', 'LATE_SUCCESS', 'CONFIRMED_RETURN');

CREATE TABLE "payment_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "provider" "payment_provider" NOT NULL,
  "settlement_kind" "payment_settlement_kind" NOT NULL DEFAULT 'NORMAL',
  "original_attempt_id" UUID,
  "compensates_event_id" UUID,
  "status" "payment_attempt_status" NOT NULL DEFAULT 'PENDING',
  "target_seller_orders_snapshot" JSONB NOT NULL,
  "amount" NUMERIC(18,0) NOT NULL,
  "external_transaction_id" VARCHAR(160),
  "expires_at" TIMESTAMPTZ(6),
  "settled_at" TIMESTAMPTZ(6),
  "operation_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "payment_attempts_snapshot_array" CHECK (jsonb_typeof("target_seller_orders_snapshot") = 'array'),
  CONSTRAINT "payment_attempts_settlement_link" CHECK (("settlement_kind" = 'NORMAL' AND "compensates_event_id" IS NULL) OR ("settlement_kind" = 'LATE_COMPENSATION' AND "compensates_event_id" IS NOT NULL))
);
CREATE INDEX "marketplace_orders_payment_deadline_idx" ON "marketplace_orders"("payment_method", "payment_deadline", "id");
CREATE UNIQUE INDEX "payment_attempts_payment_number_key" ON "payment_attempts"("payment_id", "attempt_number");
CREATE UNIQUE INDEX "payment_attempts_operation_key_key" ON "payment_attempts"("operation_key");
CREATE UNIQUE INDEX "payment_attempts_compensates_event_id_key" ON "payment_attempts"("compensates_event_id");
CREATE UNIQUE INDEX "payment_attempts_external_transaction_key" ON "payment_attempts"("provider", "external_transaction_id") WHERE "external_transaction_id" IS NOT NULL;
CREATE UNIQUE INDEX "payment_attempts_pending_mock_unique" ON "payment_attempts"("payment_id") WHERE "provider" = 'MOCK' AND "settlement_kind" = 'NORMAL' AND "status" = 'PENDING';
CREATE UNIQUE INDEX "payment_attempts_mock_success_unique" ON "payment_attempts"("payment_id") WHERE "provider" = 'MOCK' AND "settlement_kind" = 'NORMAL' AND "status" = 'SUCCEEDED';
CREATE INDEX "payment_attempts_payment_status_created_idx" ON "payment_attempts"("payment_id", "status", "created_at");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_original_attempt_id_fkey" FOREIGN KEY ("original_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "attempt_id" UUID,
  "provider" "payment_provider" NOT NULL,
  "external_event_id" VARCHAR(160) NOT NULL,
  "payload_digest" CHAR(64) NOT NULL,
  "observed_status" "payment_observed_status" NOT NULL,
  "processing_result" "payment_event_result" NOT NULL,
  "late_received_amount" NUMERIC(18,0),
  "late_received_transaction_id" VARCHAR(160),
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_events_payload_digest_check" CHECK ("payload_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "payment_events_late_payment_details" CHECK (("late_received_amount" IS NULL AND "late_received_transaction_id" IS NULL) OR ("late_received_amount" > 0 AND "late_received_transaction_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "payment_events_provider_external_event_key" ON "payment_events"("provider", "external_event_id");
CREATE INDEX "payment_events_payment_received_id_idx" ON "payment_events"("payment_id", "received_at", "id");
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_compensates_event_id_fkey" FOREIGN KEY ("compensates_event_id") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id" UUID NOT NULL,
  "seller_order_id" UUID NOT NULL,
  "amount" NUMERIC(18,0) NOT NULL,
  "kind" "payment_allocation_kind" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "payment_allocations_attempt_seller_key" ON "payment_allocations"("attempt_id", "seller_order_id");
CREATE UNIQUE INDEX "payment_allocations_cod_seller_once" ON "payment_allocations"("seller_order_id") WHERE "kind" = 'COD_COLLECTION';
CREATE INDEX "payment_allocations_seller_id_idx" ON "payment_allocations"("seller_order_id", "id");
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION require_successful_payment_attempt() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payment_attempts WHERE id = NEW.attempt_id AND status = 'SUCCEEDED') THEN
    RAISE EXCEPTION 'payment allocations require a successful attempt';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "payment_allocations_require_success" BEFORE INSERT ON "payment_allocations" FOR EACH ROW EXECUTE FUNCTION require_successful_payment_attempt();

CREATE OR REPLACE FUNCTION keep_payment_attempt_snapshot_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.target_seller_orders_snapshot IS DISTINCT FROM OLD.target_seller_orders_snapshot THEN
    RAISE EXCEPTION 'payment attempt target snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "payment_attempts_snapshot_immutable" BEFORE UPDATE OF target_seller_orders_snapshot ON "payment_attempts" FOR EACH ROW EXECUTE FUNCTION keep_payment_attempt_snapshot_immutable();

CREATE TABLE "simulated_refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "allocation_id" UUID NOT NULL,
  "seller_order_id" UUID NOT NULL,
  "amount" NUMERIC(18,0) NOT NULL,
  "reason" "simulated_refund_reason" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUCCEEDED',
  "operation_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "simulated_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "simulated_refunds_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "simulated_refunds_status_succeeded" CHECK ("status" = 'SUCCEEDED')
);
CREATE UNIQUE INDEX "simulated_refunds_allocation_id_key" ON "simulated_refunds"("allocation_id");
CREATE UNIQUE INDEX "simulated_refunds_operation_key_key" ON "simulated_refunds"("operation_key");
CREATE INDEX "simulated_refunds_seller_created_id_idx" ON "simulated_refunds"("seller_order_id", "created_at", "id");
ALTER TABLE "simulated_refunds" ADD CONSTRAINT "simulated_refunds_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "payment_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "simulated_refunds" ADD CONSTRAINT "simulated_refunds_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION match_simulated_refund_allocation() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payment_allocations WHERE id = NEW.allocation_id AND seller_order_id = NEW.seller_order_id AND amount = NEW.amount) THEN
    RAISE EXCEPTION 'simulated refund must match its payment allocation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "simulated_refunds_match_allocation" BEFORE INSERT ON "simulated_refunds" FOR EACH ROW EXECUTE FUNCTION match_simulated_refund_allocation();

CREATE OR REPLACE FUNCTION reject_payment_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "simulated_refunds_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "simulated_refunds" FOR EACH STATEMENT EXECUTE FUNCTION reject_payment_ledger_mutation();
CREATE TRIGGER "payment_allocations_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "payment_allocations" FOR EACH STATEMENT EXECUTE FUNCTION reject_payment_ledger_mutation();
CREATE TRIGGER "payment_events_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "payment_events" FOR EACH STATEMENT EXECUTE FUNCTION reject_payment_ledger_mutation();
