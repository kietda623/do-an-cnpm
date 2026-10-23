import { Suspense } from "react";
import { ProductGrid } from "../../features/discovery/product-grid";

export default function ProductsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-[var(--space-page-gutter)] py-8">
      <header>
        <h1 className="text-3xl font-semibold">Khám phá sản phẩm</h1>
        <p className="mt-2 text-neutral-600">Tìm kiếm, lọc và sắp xếp sản phẩm đang được bán.</p>
      </header>
      <Suspense fallback={<p className="py-8 text-center">Đang tải sản phẩm…</p>}>
        <ProductGrid />
      </Suspense>
    </main>
  );
}
