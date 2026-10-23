CREATE TYPE "shop_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');
CREATE TYPE "shop_member_role" AS ENUM ('OWNER', 'MANAGER');
CREATE TYPE "shop_member_status" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "shops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug_normalized" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "logo_asset_id" UUID NOT NULL,
    "banner_asset_id" UUID,
    "contact_address" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "status" "shop_status" NOT NULL DEFAULT 'PENDING',
    "decision_reason" VARCHAR(500),
    "approved_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shops_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shops_name_nonempty" CHECK (length(btrim("name")) BETWEEN 1 AND 150),
    CONSTRAINT "shops_slug_canonical" CHECK ("slug_normalized" = lower("slug_normalized") AND "slug_normalized" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug_normalized") BETWEEN 3 AND 80),
    CONSTRAINT "shops_description_nonempty" CHECK (length(btrim("description")) BETWEEN 1 AND 5000),
    CONSTRAINT "shops_contact_address_nonempty" CHECK (length(btrim("contact_address")) BETWEEN 1 AND 500),
    CONSTRAINT "shops_phone_length" CHECK (length("phone") BETWEEN 8 AND 20),
    CONSTRAINT "shops_version_nonnegative" CHECK ("version" >= 0),
    CONSTRAINT "shops_decision_state_consistent" CHECK (
        ("status" IN ('REJECTED', 'SUSPENDED') AND "decision_reason" IS NOT NULL AND length(btrim("decision_reason")) BETWEEN 1 AND 500)
        OR ("status" NOT IN ('REJECTED', 'SUSPENDED') AND "decision_reason" IS NULL)
    ),
    CONSTRAINT "shops_approval_state_consistent" CHECK (
        ("status" IN ('ACTIVE', 'SUSPENDED') AND "approved_at" IS NOT NULL)
        OR ("status" IN ('PENDING', 'REJECTED') AND "approved_at" IS NULL)
    )
);

CREATE TABLE "shop_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "shop_member_role" NOT NULL,
    "status" "shop_member_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shops_slug_normalized_key" ON "shops"("slug_normalized");
CREATE UNIQUE INDEX "shops_logo_asset_id_key" ON "shops"("logo_asset_id");
CREATE UNIQUE INDEX "shops_banner_asset_id_key" ON "shops"("banner_asset_id");
CREATE INDEX "shops_status_created_at_id_idx" ON "shops"("status", "created_at", "id");
CREATE UNIQUE INDEX "shop_members_shop_id_user_id_key" ON "shop_members"("shop_id", "user_id");
CREATE INDEX "shop_members_user_id_status_shop_id_idx" ON "shop_members"("user_id", "status", "shop_id");
CREATE UNIQUE INDEX "shop_members_one_owner_per_shop_key" ON "shop_members"("shop_id") WHERE "role" = 'OWNER';

ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shops" ADD CONSTRAINT "shops_logo_asset_id_fkey" FOREIGN KEY ("logo_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shops" ADD CONSTRAINT "shops_banner_asset_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION enforce_owner_membership_match() RETURNS TRIGGER AS $$
DECLARE
    shop_owner UUID;
BEGIN
    IF NEW.role = 'OWNER' THEN
        SELECT owner_user_id INTO shop_owner FROM shops WHERE id = NEW.shop_id;
        IF shop_owner IS NULL OR NEW.user_id <> shop_owner THEN
            RAISE EXCEPTION 'OWNER membership must match shops.owner_user_id' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_members_owner_matches_shop
    BEFORE INSERT OR UPDATE OF shop_id, user_id, role ON "shop_members"
    FOR EACH ROW EXECUTE FUNCTION enforce_owner_membership_match();

CREATE FUNCTION enforce_shop_asset_binding() RETURNS TRIGGER AS $$
DECLARE
    shop_owner UUID;
    matching_asset UUID;
BEGIN
    IF NEW.shop_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT owner_user_id INTO shop_owner FROM shops WHERE id = NEW.shop_id;
    IF shop_owner IS NULL THEN
        RAISE EXCEPTION 'shop asset references a missing shop' USING ERRCODE = '23503';
    END IF;
    IF NEW.purpose = 'SHOP_LOGO' THEN
        SELECT logo_asset_id INTO matching_asset FROM shops WHERE id = NEW.shop_id;
    ELSIF NEW.purpose = 'SHOP_BANNER' THEN
        SELECT banner_asset_id INTO matching_asset FROM shops WHERE id = NEW.shop_id;
    END IF;
    IF NEW.purpose IN ('SHOP_LOGO', 'SHOP_BANNER') AND matching_asset <> NEW.id THEN
        RAISE EXCEPTION 'shop identity asset must be referenced by its shop' USING ERRCODE = '23514';
    END IF;
    IF NEW.purpose IN ('SHOP_LOGO', 'SHOP_BANNER') AND NEW.uploader_user_id <> shop_owner THEN
        RAISE EXCEPTION 'shop identity asset must be uploaded by the shop owner' USING ERRCODE = '23514';
    END IF;
    IF NEW.purpose = 'SHOP_LOGO' AND NEW.status <> 'VERIFIED' THEN
        RAISE EXCEPTION 'shop logo must be verified before binding' USING ERRCODE = '23514';
    END IF;
    IF NEW.purpose = 'SHOP_BANNER' AND NEW.status <> 'VERIFIED' THEN
        RAISE EXCEPTION 'shop banner must be verified before binding' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assets_shop_identity_binding
    BEFORE INSERT OR UPDATE OF shop_id, uploader_user_id, purpose, status ON "assets"
    FOR EACH ROW EXECUTE FUNCTION enforce_shop_asset_binding();

CREATE FUNCTION prevent_approved_shop_slug_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.approved_at IS NOT NULL AND NEW.slug_normalized <> OLD.slug_normalized THEN
        RAISE EXCEPTION 'approved shop slug is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shops_approved_slug_immutable
    BEFORE UPDATE OF slug_normalized ON "shops"
    FOR EACH ROW EXECUTE FUNCTION prevent_approved_shop_slug_change();
