import { Suspense } from "react";
import Link from "next/link";
import { OrderRail, ShieldCheck, Store, Truck } from "@marketplace/ui-web";
import { CategoryStrip } from "../features/discovery/category-strip";
import { ProductGrid } from "../features/discovery/product-grid";

const orderSteps = [
  {
    id: "browse",
    label: "Chọn sản phẩm",
    meta: "Nhiều cửa hàng, một giỏ",
    tone: "done" as const,
  },
  {
    id: "place",
    label: "Đặt và thanh toán",
    meta: "COD hoặc mô phỏng",
    tone: "active" as const,
  },
  {
    id: "ship",
    label: "Cửa hàng giao hàng",
    meta: "Theo dõi từng kiện",
    tone: "neutral" as const,
  },
  {
    id: "receive",
    label: "Xác nhận nhận hàng",
    meta: "Khi đã giao đủ",
    tone: "neutral" as const,
  },
];

export default function HomePage() {
  return (
    <div className="mp-container mp-home">
      <section className="mp-hero mp-reveal" aria-labelledby="home-heading">
        <div className="mp-hero__copy">
          <p className="mp-eyebrow">Điều phối đơn hàng nhiều cửa hàng</p>
          <h1 id="home-heading" className="mp-hero__title">
            Khám phá sản phẩm từ các cửa hàng
          </h1>
          <p className="mp-hero__description">
            Một giỏ hàng, nhiều cửa hàng. Mỗi phần đơn được theo dõi vận chuyển riêng và
            hủy độc lập khi cửa hàng chưa xác nhận.
          </p>
          <div className="mp-hero__actions">
            <Link className="mp-button mp-button--primary mp-button--lg" href="/products">
              Xem tất cả sản phẩm
            </Link>
            <Link className="mp-button mp-button--secondary mp-button--lg" href="/orders">
              Đơn hàng của tôi
            </Link>
          </div>
          <dl className="mp-hero__facts">
            <div>
              <dt>
                <Store size={16} aria-hidden="true" /> Theo cửa hàng
              </dt>
              <dd>Mỗi cửa hàng xác nhận, đóng gói và giao phần hàng của mình.</dd>
            </div>
            <div>
              <dt>
                <Truck size={16} aria-hidden="true" /> Theo dõi riêng
              </dt>
              <dd>Mã vận chuyển và lịch sử giao được hiển thị cho từng kiện hàng.</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={16} aria-hidden="true" /> Thanh toán rõ ràng
              </dt>
              <dd>Chọn COD hoặc thanh toán mô phỏng; giá được xác nhận lại khi đặt.</dd>
            </div>
          </dl>
        </div>
        <aside className="mp-hero__aside" aria-labelledby="order-steps-heading">
          <div className="mp-hero__panel">
            <p className="mp-eyebrow">Cách đặt hàng</p>
            <h2 id="order-steps-heading" className="mp-hero__panel-title">
              Một đường ray cho mỗi đơn
            </h2>
            <OrderRail
              label="Cách đặt hàng trên Marketplace"
              steps={orderSteps}
              orientation="vertical"
            />
            <p className="mp-hero__panel-note">
              Trạng thái từng cửa hàng hiển thị riêng, nên bạn luôn biết phần nào đang được
              xử lý.
            </p>
          </div>
        </aside>
      </section>

      <CategoryStrip />

      <section className="mp-section mp-reveal" aria-labelledby="new-products">
        <div className="mp-section__head">
          <div>
            <p className="mp-eyebrow">Tín hiệu mới</p>
            <h2 id="new-products">Sản phẩm mới</h2>
          </div>
          <Link className="mp-link-arrow" href="/products">
            Xem tất cả
          </Link>
        </div>
        <Suspense fallback={<p className="mp-section__loading" role="status">Đang tải sản phẩm…</p>}>
          <ProductGrid />
        </Suspense>
      </section>
    </div>
  );
}
