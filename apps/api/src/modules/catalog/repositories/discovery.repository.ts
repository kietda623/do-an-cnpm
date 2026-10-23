import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client.js";
import { DatabaseService } from "../../../database/prisma.service.js";

export type DiscoveryFilters = {
  q?: string;
  categoryId?: string;
  shopId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort: "PRICE_ASC" | "PRICE_DESC" | "NEWEST";
  page: number;
  pageSize: number;
};

export type DiscoveryKey = {
  id: string;
  shopName: string;
  minimumPrice: string;
  available: boolean;
  createdAt: Date;
};

@Injectable()
export class DiscoveryRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(filters: DiscoveryFilters) {
    const visibleTree = Prisma.sql`
      WITH RECURSIVE visible_categories AS (
        SELECT id, parent_id FROM categories WHERE status = 'VISIBLE' AND parent_id IS NULL
        UNION ALL
        SELECT child.id, child.parent_id
        FROM categories child JOIN visible_categories parent ON child.parent_id = parent.id
        WHERE child.status = 'VISIBLE'
      ), selected_categories AS (
        SELECT id FROM visible_categories WHERE id = ${filters.categoryId ?? null}::uuid
        UNION ALL
        SELECT child.id FROM categories child JOIN selected_categories parent ON child.parent_id = parent.id
        WHERE child.status = 'VISIBLE'
      ), eligible_products AS (
        SELECT p.id, p.shop_id, p.name, p.description, p.category_id, s.name AS shop_name, p.created_at,
          MIN(v.price) AS minimum_price,
          BOOL_OR(COALESCE(i.available_quantity, 0) > 0) AS available
        FROM products p
        JOIN shops s ON s.id = p.shop_id AND s.status = 'ACTIVE'
        JOIN visible_categories vc ON vc.id = p.category_id
        JOIN product_variants v ON v.product_id = p.id AND v.shop_id = p.shop_id AND v.sale_status = 'ACTIVE'
        LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = v.shop_id
        WHERE p.sale_status = 'ACTIVE' AND p.admin_hidden = false
          AND (${filters.shopId ?? null}::uuid IS NULL OR p.shop_id = ${filters.shopId ?? null}::uuid)
          AND (${filters.categoryId ?? null}::uuid IS NULL OR p.category_id IN (SELECT id FROM selected_categories))
          AND (${filters.q ?? null}::text IS NULL OR p.name ILIKE '%' || ${filters.q ?? null} || '%'
            OR p.description ILIKE '%' || ${filters.q ?? null} || '%')
        GROUP BY p.id, s.name
        HAVING (${filters.minPrice ?? null}::numeric IS NULL OR MIN(v.price) >= ${filters.minPrice ?? null}::numeric)
          AND (${filters.maxPrice ?? null}::numeric IS NULL OR MIN(v.price) <= ${filters.maxPrice ?? null}::numeric)
      )`;

    const countRows = await this.db.prisma.$queryRaw<Array<{ total: number }>>`
      ${visibleTree} SELECT COUNT(*)::int AS total FROM eligible_products`;
    const items = await this.db.prisma.$queryRaw<DiscoveryKey[]>`
      ${visibleTree}
      SELECT id, shop_name AS "shopName", minimum_price::text AS "minimumPrice", available, created_at AS "createdAt"
      FROM eligible_products
      ORDER BY
        CASE WHEN ${filters.sort} = 'PRICE_ASC' THEN minimum_price END ASC,
        CASE WHEN ${filters.sort} = 'PRICE_DESC' THEN minimum_price END DESC,
        CASE WHEN ${filters.sort} = 'NEWEST' THEN created_at END DESC,
        id ASC
      LIMIT ${filters.pageSize} OFFSET ${(filters.page - 1) * filters.pageSize}`;
    return { items, total: countRows[0]?.total ?? 0 };
  }
}
