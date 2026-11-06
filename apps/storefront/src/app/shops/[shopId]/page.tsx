"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
} from "@marketplace/api-client";
import { StatusMessage, Store, useApi } from "@marketplace/ui-web";
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
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    setLoading(true);
    setError("");
    setLoading(true);
    void api
      .request<Shop>(`/shops/${shopId}` as ApiPath)
      .then((value) => {
        if (live) {
          setShop(value);
        }
      })
      .catch((cause: unknown) => {
        if (live)
          setError(
            cause instanceof ApiClientError && cause.status === 404
              ? "Cửa hàng không tồn tại hoặc chưa mở bán."
              : normalizeFormError(cause),
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, attempt, shopId, status]);

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
          {error}{" "}
          <button
            type="button"
            className="mp-link"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>{" "}
          <Link className="mp-link" href="/products">
            Khám phá sản phẩm
          </Link>
        </StatusMessage>
      </div>
    );

  return (
    <div className="mp-container mp-shop">
      <header className="mp-shop-hero">
        <div className="mp-shop-hero__banner">
          {shop.banner ? (
            <img src={shop.banner.url} alt="" />
          ) : (
            <span
              className="mp-shop-hero__banner-placeholder"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="mp-shop-hero__identity">
          {shop.logo ? (
            <img className="mp-shop-hero__logo" src={shop.logo.url} alt="" />
          ) : (
            <span
              className="mp-shop-hero__logo mp-shop-hero__logo--placeholder"
              aria-hidden="true"
            >
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
