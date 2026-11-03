"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type ApiPath } from "@marketplace/api-client";
import { EmptyState, StatusMessage, Store, useApi } from "@marketplace/ui-web";
import { ProductGrid } from "../../../features/discovery/product-grid";

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: { url: string } | null;
  banner: { url: string } | null;
};

export default function PublicShopPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api, status } = useApi();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    setLoading(true);
    void api
      .request<Shop>(`/shops/${shopId}` as ApiPath)
      .then((value) => {
        if (live) {
          setShop(value);
          setError(false);
        }
      })
      .catch(() => {
        if (live) setError(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, shopId, status]);

  if (loading)
    return (
      <div className="mp-container" aria-busy="true">
        <span className="mp-skeleton mp-shop-hero__skeleton" />
        <p className="mp-visually-hidden" role="status">
          Đang tải cửa hàng…
        </p>
      </div>
    );

  if (error || !shop)
    return (
      <div className="mp-container">
        <StatusMessage tone="error" title="Không mở được cửa hàng">
          Cửa hàng không tồn tại hoặc chưa mở bán.{" "}
          <Link className="mp-link" href="/products">
            Khám phá sản phẩm
          </Link>
        </StatusMessage>
        <EmptyState
          icon={<Store size={22} />}
          title="Cửa hàng chưa sẵn sàng"
          description="Anh có thể tiếp tục xem các sản phẩm khác trên sàn."
        />
      </div>
    );

  return (
    <div className="mp-container mp-shop">
      <header className="mp-shop-hero">
        <div className="mp-shop-hero__banner">
          {shop.banner ? (
            <img src={shop.banner.url} alt="" />
          ) : (
            <span className="mp-shop-hero__banner-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="mp-shop-hero__identity">
          {shop.logo ? (
            <img className="mp-shop-hero__logo" src={shop.logo.url} alt="" />
          ) : (
            <span className="mp-shop-hero__logo mp-shop-hero__logo--placeholder" aria-hidden="true">
              <Store size={22} />
            </span>
          )}
          <div>
            <h1>{shop.name}</h1>
            <p>{shop.description}</p>
          </div>
        </div>
      </header>

      <section className="mp-section" aria-labelledby="shop-products">
        <div className="mp-section__head">
          <h2 id="shop-products">Sản phẩm của cửa hàng</h2>
        </div>
        <ProductGrid endpoint={`/shops/${shopId}/products`} />
      </section>
    </div>
  );
}
