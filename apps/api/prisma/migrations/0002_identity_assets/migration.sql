-- CreateEnum
CREATE TYPE "system_role" AS ENUM ('BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "session_platform" AS ENUM ('WEB', 'MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "client_platform" AS ENUM ('WEB', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS');

-- CreateEnum
CREATE TYPE "asset_purpose" AS ENUM ('AVATAR', 'SHOP_LOGO', 'SHOP_BANNER', 'PRODUCT_IMAGE');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_normalized" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_asset_id" UUID,
    "system_role" "system_role" NOT NULL DEFAULT 'BUYER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "auth_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "platform" "session_platform" NOT NULL,
    "client_platform" "client_platform" NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_session_id" UUID,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "line1" VARCHAR(250) NOT NULL,
    "ward" VARCHAR(120) NOT NULL,
    "district" VARCHAR(120) NOT NULL,
    "province" VARCHAR(120) NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'VN',
    "postal_code" VARCHAR(20),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uploader_user_id" UUID NOT NULL,
    "shop_id" UUID,
    "purpose" "asset_purpose" NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "status" "asset_status" NOT NULL DEFAULT 'PENDING',
    "attached_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "users_status_created_at_id_idx" ON "users"("status", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_hash_key" ON "sessions"("refresh_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_replaced_by_session_id_key" ON "sessions"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_deleted_at_idx" ON "addresses"("user_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_object_key_key" ON "assets"("object_key");

-- CreateIndex
CREATE INDEX "assets_uploader_status_created_at_id_idx" ON "assets"("uploader_user_id", "status", "created_at", "id");

-- CreateIndex
CREATE INDEX "assets_shop_purpose_status_id_idx" ON "assets"("shop_id", "purpose", "status", "id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replaced_by_session_id_fkey" FOREIGN KEY ("replaced_by_session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep identity values canonical at the database boundary as well as in API validation.
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_normalized_canonical"
        CHECK ("email_normalized" = lower(btrim("email_normalized")) AND length("email_normalized") BETWEEN 3 AND 254),
    ADD CONSTRAINT "users_auth_version_nonnegative"
        CHECK ("auth_version" >= 0);

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_refresh_hash_sha256"
        CHECK ("refresh_hash" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "sessions_expiry_within_seven_days"
        CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + INTERVAL '7 days'),
    ADD CONSTRAINT "sessions_not_replaced_by_self"
        CHECK ("replaced_by_session_id" IS NULL OR "replaced_by_session_id" <> "id");

ALTER TABLE "addresses"
    ADD CONSTRAINT "addresses_country_vn"
        CHECK ("country" = 'VN');

CREATE UNIQUE INDEX "addresses_one_live_default_per_user_key"
    ON "addresses"("user_id")
    WHERE "is_default" AND "deleted_at" IS NULL;

ALTER TABLE "assets"
    ADD CONSTRAINT "assets_byte_size_range"
        CHECK ("byte_size" BETWEEN 1 AND 5242880),
    ADD CONSTRAINT "assets_mime_type_allowlist"
        CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    ADD CONSTRAINT "assets_dimensions_positive"
        CHECK ("width" > 0 AND "height" > 0);
