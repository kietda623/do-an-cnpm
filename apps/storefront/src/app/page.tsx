import { Suspense } from "react";
import Link from "next/link";
import { PackageCheck, ShieldCheck, Store, Truck } from "@marketplace/ui-web";
import { CategoryStrip } from "../features/discovery/category-strip";
import { ProductGrid } from "../features/discovery/product-grid";

export default function HomePage() {
  return (
    <div className="mp-container mp-home">
      <section className="mp-hero" aria-labelledby="home-heading">
        <div className="mp-hero__copy">
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
        <div className="mp-hero__aside" aria-hidden="true">
          <div className="mp-hero__tile">
            <PackageCheck size={22} />
            <span>Xác nhận nhận hàng</span>
            <small>Chỉ khi đã giao đủ và thanh toán xong</small>
          </div>
          <div className="mp-hero__tile mp-hero__tile--accent">
            <Store size={22} />
            <span>Nhiều cửa hàng</span>
            <small>Tách đơn, tách trạng thái, tách hủy</small>
          </div>
        </div>
      </section>

      <CategoryStrip />

      <section className="mp-section" aria-labelledby="new-products">
        <div className="mp-section__head">
          <h2 id="new-products">Sản phẩm mới</h2>
          <Link href="/products">Xem tất cả</Link>
        </div>
        <Suspense fallback={<p className="mp-section__loading" role="status">Đang tải sản phẩm…</p>}>
          <ProductGrid />
        </Suspense>
      </section>
    </div>
  );
}
