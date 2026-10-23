import { Suspense } from "react";
import Link from "next/link";
import { ProductGrid } from "../features/discovery/product-grid";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-[var(--space-page-gutter)] py-8">
      <header className="rounded-2xl bg-neutral-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide">
          Marketplace đa người bán
        </p>
        <h1 className="max-w-2xl text-3xl font-bold sm:text-5xl">
          Khám phá sản phẩm từ các cửa hàng
        </h1>
        <p className="mt-4 max-w-xl text-white/80">
          Tìm món đồ phù hợp từ những người bán đã được xác minh.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-white px-5 font-semibold text-neutral-900"
        >
          Xem tất cả sản phẩm
        </Link>
      </header>
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Sản phẩm mới</h2>
        <Suspense fallback={<p className="py-8 text-center">Đang tải sản phẩm…</p>}>
          <ProductGrid />
        </Suspense>
      </div>
    </main>
  );
}
