CREATE TYPE "idempotency_state" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "actor_kind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "shop_id" UUID,
    "reason" TEXT,
    "outcome" TEXT NOT NULL,
    "request_id" UUID NOT NULL,
    "safe_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_events_actor_kind_nonempty" CHECK (length(btrim("actor_kind")) > 0),
    CONSTRAINT "audit_events_action_nonempty" CHECK (length(btrim("action")) > 0),
    CONSTRAINT "audit_events_target_type_nonempty" CHECK (length(btrim("target_type")) > 0),
    CONSTRAINT "audit_events_outcome_nonempty" CHECK (length(btrim("outcome")) > 0),
    CONSTRAINT "audit_events_safe_metadata_object" CHECK (jsonb_typeof("safe_metadata") = 'object')
);

CREATE INDEX "audit_events_target_type_target_id_created_at_id_idx"
    ON "audit_events"("target_type", "target_id", "created_at", "id");
CREATE INDEX "audit_events_actor_user_id_created_at_id_idx"
    ON "audit_events"("actor_user_id", "created_at", "id");
CREATE INDEX "audit_events_request_id_idx" ON "audit_events"("request_id");

CREATE FUNCTION "reject_audit_event_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only; % is not permitted', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "audit_events_append_only_rows"
    BEFORE UPDATE OR DELETE ON "audit_events"
    FOR EACH ROW EXECUTE FUNCTION "reject_audit_event_mutation"();
CREATE TRIGGER "audit_events_append_only_truncate"
    BEFORE TRUNCATE ON "audit_events"
    FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_event_mutation"();

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "actor_scope" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "state" "idempotency_state" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "resource_type" TEXT,
    "resource_id" UUID,
    "response_summary" JSONB,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_records_scope_nonempty" CHECK (length(btrim("actor_scope")) > 0),
    CONSTRAINT "idempotency_records_operation_nonempty" CHECK (length(btrim("operation")) > 0),
    CONSTRAINT "idempotency_records_key_nonempty" CHECK (length(btrim("idempotency_key")) > 0),
    CONSTRAINT "idempotency_records_request_hash_sha256" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "idempotency_records_completion_state"
        CHECK (
            ("state" = 'IN_PROGRESS' AND "response_status" IS NULL)
            OR (
                "state" = 'COMPLETED'
                AND "response_status" IS NOT NULL
                AND "response_status" BETWEEN 100 AND 599
            )
        ),
    CONSTRAINT "idempotency_records_response_summary_object"
        CHECK ("response_summary" IS NULL OR jsonb_typeof("response_summary") = 'object')
);

CREATE UNIQUE INDEX "idempotency_records_actor_scope_operation_idempotency_key_key"
    ON "idempotency_records"("actor_scope", "operation", "idempotency_key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");
CREATE INDEX "idempotency_records_actor_user_id_created_at_id_idx"
    ON "idempotency_records"("actor_user_id", "created_at", "id");
