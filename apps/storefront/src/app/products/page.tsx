import { Suspense } from "react";
import { PageHeader } from "@marketplace/ui-web";
import { ProductGrid } from "../../features/discovery/product-grid";

export default function ProductsPage() {
  return (
    <div className="mp-container mp-catalog">
      <PageHeader
        title="Khám phá sản phẩm"
        description="Tìm theo tên, lọc theo danh mục và khoảng giá. Tồn kho được kiểm tra lại ở bước thanh toán."
      />
      <Suspense fallback={<p className="mp-section__loading" role="status">Đang tải sản phẩm…</p>}>
        <ProductGrid />
      </Suspense>
    </div>
  );
}
