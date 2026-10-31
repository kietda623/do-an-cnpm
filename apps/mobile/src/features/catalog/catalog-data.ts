import type { ApiPath } from "@marketplace/api-client";

export const CATALOG_PAGE_SIZE = 20;

export type CatalogSort = "NEWEST" | "PRICE_ASC" | "PRICE_DESC";

export type CatalogFilters = {
  q?: string;
  categoryId?: string;
  shopId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort: CatalogSort;
  page: number;
};

export function routeParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function routePage(value: string | string[] | undefined): number {
  const page = Number(routeParam(value));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function buildProductPath(
  filters: CatalogFilters,
  endpoint = "/products",
): ApiPath {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.shopId) params.set("shopId", filters.shopId);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("pageSize", String(CATALOG_PAGE_SIZE));
  return `${endpoint}?${params.toString()}` as ApiPath;
}

export function buildReviewsPath(productId: string, page: number): ApiPath {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(CATALOG_PAGE_SIZE),
  });
  return `/products/${encodeURIComponent(productId)}/reviews?${params.toString()}` as ApiPath;
}

export function isValidPriceRange(minPrice: string, maxPrice: string): boolean {
  const validInteger = (value: string) =>
    value === "" || (/^\d+$/.test(value) && value.length <= 18);
  if (!validInteger(minPrice) || !validInteger(maxPrice)) return false;
  if (!minPrice || !maxPrice) return true;
  return BigInt(minPrice) <= BigInt(maxPrice);
}

export function formatVnd(value?: string | null): string {
  if (!value || !/^\d+$/.test(value)) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(BigInt(value))}₫`;
}
