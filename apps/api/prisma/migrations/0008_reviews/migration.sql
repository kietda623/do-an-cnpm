CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buyer_user_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "comment" VARCHAR(2000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "reviews_order_item_id_key" ON "reviews"("order_item_id");
CREATE INDEX "reviews_product_created_id_idx" ON "reviews"("product_id", "created_at", "id");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
