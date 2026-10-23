CREATE TYPE "payment_method" AS ENUM ('COD', 'MOCK');
CREATE TYPE "marketplace_order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "seller_order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "carts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buyer_user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "carts_version_nonnegative" CHECK ("version" >= 0)
);
CREATE UNIQUE INDEX "carts_buyer_user_id_key" ON "carts"("buyer_user_id");
ALTER TABLE "carts" ADD CONSTRAINT "carts_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cart_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cart_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cart_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 999),
  CONSTRAINT "cart_items_version_nonnegative" CHECK ("version" >= 0)
);
CREATE UNIQUE INDEX "cart_items_cart_variant_key" ON "cart_items"("cart_id", "variant_id");
CREATE INDEX "cart_items_cart_selected_id_idx" ON "cart_items"("cart_id", "selected", "id");
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "marketplace_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buyer_user_id" UUID NOT NULL,
  "public_number" VARCHAR(32) NOT NULL,
  "recipient_snapshot" JSONB NOT NULL,
  "payment_method" "payment_method" NOT NULL,
  "original_total" NUMERIC(18,0) NOT NULL,
  "shipping_total" NUMERIC(18,0) NOT NULL DEFAULT 0,
  "payment_deadline" TIMESTAMPTZ(6),
  "status" "marketplace_order_status" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_orders_total_positive" CHECK ("original_total" > 0),
  CONSTRAINT "marketplace_orders_shipping_zero" CHECK ("shipping_total" = 0),
  CONSTRAINT "marketplace_orders_version_nonnegative" CHECK ("version" >= 0),
  CONSTRAINT "marketplace_orders_deadline_consistent" CHECK (("payment_method" = 'MOCK' AND "payment_deadline" IS NOT NULL AND "payment_deadline" = "created_at" + INTERVAL '15 minutes') OR ("payment_method" = 'COD' AND "payment_deadline" IS NULL))
);
CREATE UNIQUE INDEX "marketplace_orders_public_number_key" ON "marketplace_orders"("public_number");
CREATE INDEX "marketplace_orders_buyer_created_id_idx" ON "marketplace_orders"("buyer_user_id", "created_at", "id");
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "seller_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "shop_id" UUID NOT NULL,
  "shop_name_snapshot" VARCHAR(150) NOT NULL,
  "status" "seller_order_status" NOT NULL DEFAULT 'PENDING',
  "original_total" NUMERIC(18,0) NOT NULL,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" VARCHAR(500),
  "completed_at" TIMESTAMPTZ(6),
  "stock_returned_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_orders_total_positive" CHECK ("original_total" > 0),
  CONSTRAINT "seller_orders_version_nonnegative" CHECK ("version" >= 0),
  CONSTRAINT "seller_orders_cancel_consistent" CHECK (("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL) OR ("status" <> 'CANCELLED' AND "cancelled_at" IS NULL AND "cancellation_reason" IS NULL))
);
CREATE UNIQUE INDEX "seller_orders_order_shop_key" ON "seller_orders"("order_id", "shop_id");
CREATE UNIQUE INDEX "seller_orders_id_shop_key" ON "seller_orders"("id", "shop_id");
CREATE INDEX "seller_orders_shop_status_created_id_idx" ON "seller_orders"("shop_id", "status", "created_at", "id");
CREATE INDEX "seller_orders_shop_completed_id_idx" ON "seller_orders"("shop_id", "completed_at", "id");
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_order_id" UUID NOT NULL,
  "shop_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "product_name_snapshot" VARCHAR(200) NOT NULL,
  "sku_snapshot" VARCHAR(100) NOT NULL,
  "attributes_snapshot" JSONB NOT NULL,
  "image_asset_id" UUID,
  "image_key_snapshot" TEXT,
  "unit_price" NUMERIC(18,0) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total" NUMERIC(18,0) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_positive_line" CHECK ("quantity" > 0 AND "unit_price" > 0 AND "line_total" = "unit_price" * "quantity")
);
CREATE UNIQUE INDEX "order_items_seller_variant_key" ON "order_items"("seller_order_id", "variant_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id", "id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_order_id_shop_id_fkey" FOREIGN KEY ("seller_order_id", "shop_id") REFERENCES "seller_orders"("id", "shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_shop_id_fkey" FOREIGN KEY ("variant_id", "shop_id") REFERENCES "product_variants"("id", "shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_shop_id_fkey" FOREIGN KEY ("product_id", "shop_id") REFERENCES "products"("id", "shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "checkout_quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buyer_user_id" UUID NOT NULL,
  "cart_id" UUID NOT NULL,
  "cart_version" INTEGER NOT NULL,
  "selected_items_snapshot" JSONB NOT NULL,
  "address_id" UUID NOT NULL,
  "recipient_snapshot" JSONB NOT NULL,
  "payment_method" "payment_method" NOT NULL,
  "total" NUMERIC(18,0) NOT NULL,
  "canonical_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_order_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkout_quotes_total_positive" CHECK ("total" > 0)
);
CREATE UNIQUE INDEX "checkout_quotes_consumed_order_id_key" ON "checkout_quotes"("consumed_order_id");
CREATE INDEX "checkout_quotes_buyer_expiry_id_idx" ON "checkout_quotes"("buyer_user_id", "expires_at", "id");
CREATE INDEX "checkout_quotes_expires_at_idx" ON "checkout_quotes"("expires_at");
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_consumed_order_id_fkey" FOREIGN KEY ("consumed_order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "seller_order_id" UUID,
  "actor_user_id" UUID,
  "actor_kind" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "reason" TEXT,
  "operation_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_events_actor_kind_check" CHECK ("actor_kind" IN ('USER', 'SYSTEM'))
);
CREATE UNIQUE INDEX "order_events_operation_key_key" ON "order_events"("operation_key");
CREATE INDEX "order_events_order_created_id_idx" ON "order_events"("order_id", "created_at", "id");
CREATE INDEX "order_events_seller_created_id_idx" ON "order_events"("seller_order_id", "created_at", "id");
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "method" "payment_method" NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'VND',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_currency_vnd" CHECK ("currency" = 'VND'),
  CONSTRAINT "payments_version_nonnegative" CHECK ("version" >= 0)
);
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_restore_refs" CHECK (("kind" IN ('SALE', 'CANCEL_RETURN', 'CONFIRMED_RETURN') AND "seller_order_id" IS NOT NULL AND "order_item_id" IS NOT NULL) OR ("kind" IN ('INITIAL', 'ADJUST') AND "seller_order_id" IS NULL AND "order_item_id" IS NULL));
CREATE UNIQUE INDEX "inventory_movements_sale_effect_unique" ON "inventory_movements"("order_item_id") WHERE "effect_type" = 'SALE';
CREATE UNIQUE INDEX "inventory_movements_restore_effect_unique" ON "inventory_movements"("order_item_id") WHERE "effect_type" = 'RESTORE';
