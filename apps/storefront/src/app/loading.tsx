import { Skeleton } from "@marketplace/ui-web";

export default function Loading() {
  return (
    <main className="mp-storefront__main">
      <div className="mp-container mp-loading-page" role="status">
        <span className="mp-visually-hidden">Đang tải nội dung…</span>
        <Skeleton className="mp-skeleton--line" />
        <Skeleton className="mp-skeleton--cell" />
        <div className="mp-product-grid" aria-hidden="true">
          <Skeleton className="mp-skeleton--block" />
          <Skeleton className="mp-skeleton--block" />
          <Skeleton className="mp-skeleton--block" />
          <Skeleton className="mp-skeleton--block" />
        </div>
      </div>
    </main>
  );
}
