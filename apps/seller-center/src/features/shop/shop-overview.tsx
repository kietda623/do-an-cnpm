"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  ChartLine,
  formatDate,
  Package,
  ReceiptText,
  Settings,
  statusOf,
  shopStatuses,
  Store,
} from "@marketplace/ui-web";
import type { Shop } from "../../lib/types";

export function ShopOverview({ shop }: { shop: Shop }) {
  const status = statusOf(shopStatuses, shop.status);
  const actionsAllowed = shop.status === "ACTIVE" || shop.status === "SUSPENDED";

  return (
    <section className="mp-shop-hero mp-shop-hero--console" aria-label="Thông tin cửa hàng">
      <div className="mp-shop-hero__banner">
        {shop.banner?.url ? (
          <img src={shop.banner.url} alt="Ảnh bìa cửa hàng" />
        ) : (
          <div className="mp-shop-hero__banner-placeholder" aria-hidden="true">
            <Store size={28} />
          </div>
        )}
      </div>
      <div className="mp-shop-hero__identity">
        {shop.logo?.url ? (
          <img className="mp-shop-hero__logo" src={shop.logo.url} alt="Logo cửa hàng" />
        ) : (
          <span className="mp-shop-hero__logo mp-shop-hero__logo--placeholder" aria-hidden="true">
            <Store size={22} />
          </span>
        )}
        <div>
          <div className="mp-inline">
            <h2>{shop.name}</h2>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mp-muted">
            /{shop.slug} · {shop.phone}
          </p>
          <p className="mp-muted">{shop.contactAddress}</p>
        </div>
      </div>
      <dl className="mp-shop-hero__facts">
        <div>
          <dt>Mã trạng thái</dt>
          <dd>
            <code className="mp-code">{shop.status}</code>
          </dd>
        </div>
        <div>
          <dt>Ngày duyệt</dt>
          <dd>{shop.approvedAt ? formatDate(shop.approvedAt) : "Chưa duyệt"}</dd>
        </div>
        <div>
          <dt>Phiên bản hồ sơ</dt>
          <dd data-numeric>v{shop.version}</dd>
        </div>
      </dl>
      {shop.rejectionReason ? (
        <p className="mp-alert-inline" role="alert">
          Lý do từ chối: {shop.rejectionReason}
        </p>
      ) : null}
      {actionsAllowed ? (
        <div className="mp-shop-hero__actions">
          <Link className="mp-button mp-button--primary mp-button--md" href={`/shops/${shop.id}/dashboard`}>
            <ChartLine size={16} aria-hidden="true" />
            <span className="mp-button__label">Tổng quan</span>
          </Link>
          <Link className="mp-button mp-button--secondary mp-button--md" href={`/shops/${shop.id}/orders`}>
            <ReceiptText size={16} aria-hidden="true" />
            <span className="mp-button__label">Đơn của cửa hàng</span>
          </Link>
          <Link className="mp-button mp-button--secondary mp-button--md" href={`/shops/${shop.id}/products`}>
            <Package size={16} aria-hidden="true" />
            <span className="mp-button__label">Quản lý sản phẩm</span>
          </Link>
          <Link className="mp-button mp-button--ghost mp-button--md" href={`/shops/${shop.id}/settings`}>
            <Settings size={16} aria-hidden="true" />
            <span className="mp-button__label">Cài đặt cửa hàng</span>
          </Link>
        </div>
      ) : null}
      {shop.status === "SUSPENDED" ? (
        <p className="mp-notice-inline">
          Cửa hàng đang tạm ngưng. Bạn vẫn xử lý được các đơn đã tồn tại; hồ sơ cửa hàng chỉ đọc.
        </p>
      ) : null}
    </section>
  );
}

export function ShopStatusActions({
  shop,
  busy,
  onResubmit,
}: {
  shop: Shop;
  busy: boolean;
  onResubmit: () => void;
}) {
  if (shop.status !== "REJECTED") return null;
  return (
    <div className="mp-inline">
      <Button variant="secondary" loading={busy} onClick={onResubmit}>
        Gửi lại hồ sơ
      </Button>
      <span className="mp-muted">Chỉnh sửa hồ sơ rồi gửi lại để quản trị viên duyệt.</span>
    </div>
  );
}
