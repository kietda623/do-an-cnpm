-- CreateEnum
CREATE TYPE "category_status" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "product_sale_status" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "variant_sale_status" AS ENUM ('ACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "inventory_movement_kind" AS ENUM ('INITIAL', 'ADJUST', 'SALE', 'CANCEL_RETURN', 'CONFIRMED_RETURN');

-- CreateEnum
CREATE TYPE "inventory_effect_type" AS ENUM ('SALE', 'RESTORE');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "status" "category_status" NOT NULL DEFAULT 'VISIBLE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "sale_status" "product_sale_status" NOT NULL DEFAULT 'DRAFT',
    "admin_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "sku_normalized" VARCHAR(100) NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "attributes_key" TEXT NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "sale_status" "variant_sale_status" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "variant_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inventory_id" UUID NOT NULL,
    "seller_order_id" UUID,
    "order_item_id" UUID,
    "actor_user_id" UUID,
    "shop_id" UUID,
    "kind" "inventory_movement_kind" NOT NULL,
    "effect_type" "inventory_effect_type",
    "quantity_delta" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "operation_key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_status_id_idx" ON "categories"("parent_id", "status", "id");

-- CreateIndex
CREATE INDEX "products_shop_status_created_id_idx" ON "products"("shop_id", "sale_status", "created_at", "id");

-- CreateIndex
CREATE INDEX "products_category_status_created_id_idx" ON "products"("category_id", "sale_status", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_id_shop_id_key" ON "products"("id", "shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_asset_key" ON "product_images"("product_id", "asset_id");

-- CreateIndex
CREATE INDEX "product_variants_product_status_price_id_idx" ON "product_variants"("product_id", "sale_status", "price", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_shop_sku_key" ON "product_variants"("shop_id", "sku_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_attributes_key" ON "product_variants"("product_id", "attributes_key");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_id_shop_id_key" ON "product_variants"("id", "shop_id");

-- CreateIndex
CREATE INDEX "inventory_shop_variant_idx" ON "inventory"("shop_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_variant_shop_id_key" ON "inventory"("variant_id", "shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_operation_key_key" ON "inventory_movements"("operation_key");

-- CreateIndex
CREATE INDEX "inventory_movements_inventory_created_id_idx" ON "inventory_movements"("inventory_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_order_item_effect_key" ON "inventory_movements"("order_item_id", "effect_type");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_shop_id_fkey" FOREIGN KEY ("product_id", "shop_id") REFERENCES "products"("id", "shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_shop_id_fkey" FOREIGN KEY ("variant_id", "shop_id") REFERENCES "product_variants"("id", "shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE categories ADD CONSTRAINT categories_not_own_parent CHECK (parent_id IS DISTINCT FROM id);
ALTER TABLE products ADD CONSTRAINT products_version_nonnegative CHECK (version >= 0);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_price_positive CHECK (price > 0);
ALTER TABLE inventory ADD CONSTRAINT inventory_available_nonnegative CHECK (available_quantity >= 0);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_quantity_nonzero CHECK (quantity_delta <> 0);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_after_nonnegative CHECK (quantity_after >= 0);
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_manual_effect_check CHECK ((kind IN ('INITIAL','ADJUST') AND effect_type IS NULL) OR (kind IN ('SALE','CANCEL_RETURN','CONFIRMED_RETURN') AND effect_type IS NOT NULL));
CREATE FUNCTION reject_inventory_movement_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'inventory movement ledger is append-only' USING ERRCODE = '23000'; END;
$$;
CREATE TRIGGER inventory_movements_append_only BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();
CREATE FUNCTION verify_product_image_asset() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE product_shop UUID;
BEGIN
  SELECT shop_id INTO product_shop FROM products WHERE id = NEW.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found' USING ERRCODE = '23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM assets WHERE id = NEW.asset_id AND status = 'VERIFIED' AND purpose = 'PRODUCT_IMAGE' AND shop_id = product_shop) THEN
    RAISE EXCEPTION 'product image must be a verified asset owned by the product shop' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER product_images_verified_shop_asset BEFORE INSERT OR UPDATE ON product_images FOR EACH ROW EXECUTE FUNCTION verify_product_image_asset();
