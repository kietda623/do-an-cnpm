"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import {
  Button,
  ImageOff,
  SelectField,
  StatusMessage,
  formatVnd,
  useApi,
} from "@marketplace/ui-web";
import { ReviewList } from "../../../features/reviews/review-list";

type Product = {
  id: string;
  name: string;
  description: string;
  minimumPrice: string;
  ratingAverage?: string | null;
  ratingCount: number;
  shop: { id: string; name: string; slug: string };
  images: { url: string }[];
  variants: {
    id: string;
    sku: string;
    attributes: Record<string, string>;
    price: string;
    availableQuantity: number;
  }[];
};
export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const queryClient = useQueryClient();
  const { api, user, status } = useApi();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cartError, setCartError] = useState("");
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    void api
      .request<Product>(`/products/${productId}` as ApiPath)
      .then((value) => {
        if (!live) return;
        setProduct(value);
        setVariantId(value.variants[0]?.id ?? "");
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
  }, [api, productId]);

  if (loading)
    return (
      <div className="mp-container mp-detail" aria-busy="true">
        <span className="mp-skeleton mp-detail__media-skeleton" />
        <div className="mp-detail__info">
          <span className="mp-skeleton mp-skeleton--line" />
          <span className="mp-skeleton mp-skeleton--line" />
          <span className="mp-skeleton mp-skeleton--line" />
        </div>
        <p className="mp-visually-hidden" role="status">
          Đang tải sản phẩm…
        </p>
      </div>
    );

  if (error || !product)
    return (
      <div className="mp-container mp-detail__error">
        <StatusMessage tone="error" title="Không tìm thấy sản phẩm">
          Sản phẩm không tồn tại hoặc hiện không được bán công khai.{" "}
          <Link className="mp-link" href="/products">
            Quay lại danh sách
          </Link>
        </StatusMessage>
      </div>
    );

  const selected =
    product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
  const image = product.images[imageIndex];

  return (
    <div className="mp-container mp-detail">
      <section aria-label="Thư viện ảnh sản phẩm" className="mp-detail__gallery">
        <div className="mp-detail__image">
          {image ? (
            <img src={image.url} alt={product.name} />
          ) : (
            <span className="mp-detail__image-placeholder">
              <ImageOff size={32} aria-hidden="true" />
              <span>Chưa có ảnh sản phẩm</span>
            </span>
          )}
        </div>
        {product.images.length > 1 && (
          <div className="mp-thumbs">
            {product.images.map((item, index) => (
              <button
                key={item.url}
                type="button"
                aria-label={`Xem ảnh ${index + 1}`}
                aria-pressed={imageIndex === index}
                onClick={() => setImageIndex(index)}
                className="mp-thumbs__item"
              >
                <img src={item.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mp-detail__info">
        <Link className="mp-detail__shop" href={`/shops/${product.shop.id}`}>
          {product.shop.name}
        </Link>
        <h1 className="mp-detail__name">{product.name}</h1>
        <p className="mp-detail__price" data-numeric>
          {formatVnd(selected?.price ?? product.minimumPrice)}
        </p>

        {product.variants.length > 0 && (
          <SelectField
            label="Phân loại"
            aria-label="Phân loại sản phẩm"
            value={variantId}
            onChange={(event) => {
              setVariantId(event.target.value);
              setAdded(false);
            }}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {Object.values(variant.attributes).join(" / ") || variant.sku} ·{" "}
                {formatVnd(variant.price)}
              </option>
            ))}
          </SelectField>
        )}

        <p className="mp-detail__stock" aria-live="polite">
          {selected?.availableQuantity
            ? `Còn ${selected.availableQuantity} sản phẩm`
            : "Tạm hết hàng"}
        </p>

        {status === "loading" ? (
          <span className="mp-skeleton mp-detail__cta-skeleton" aria-hidden="true" />
        ) : user ? (
          <div className="mp-detail__cta">
            <Button
              size="lg"
              fullWidth
              loading={adding}
              disabled={!selected?.availableQuantity}
              onClick={() => {
                if (!selected) return;
                setAdding(true);
                setCartError("");
                setAdded(false);
                void api
                  .request("/cart/items", {
                    method: "POST",
                    body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
                  })
                  .then(async () => {
                    if (user) await queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
                    window.dispatchEvent(new Event("marketplace:cart-changed"));
                    setAdded(true);
                  })
                  .catch((cause) => setCartError(normalizeFormError(cause)))
                  .finally(() => setAdding(false));
              }}
            >
              {added ? "Đã thêm vào giỏ" : "Thêm vào giỏ hàng"}
            </Button>
            {cartError && (
              <p role="alert" className="mp-detail__error-text">
                {cartError}
              </p>
            )}
            {added && (
              <Link href="/cart" className="mp-link">
                Xem giỏ hàng
              </Link>
            )}
          </div>
        ) : (
          <Link
            href={`/login?returnTo=${encodeURIComponent(`/products/${product.id}`)}`}
            className="mp-button mp-button--primary mp-button--lg mp-button--block"
          >
            Đăng nhập để mua
          </Link>
        )}

        <section className="mp-detail__description">
          <h2>Mô tả</h2>
          <p>{product.description}</p>
        </section>

        <dl className="mp-detail__facts">
          <div>
            <dt>Cửa hàng</dt>
            <dd>{product.shop.name}</dd>
          </div>
          <div>
            <dt>Mã sản phẩm</dt>
            <dd>{selected?.sku ?? "—"}</dd>
          </div>
          <div>
            <dt>Thanh toán</dt>
            <dd>COD hoặc mô phỏng</dd>
          </div>
        </dl>
      </section>

      <ReviewList
        productId={product.id}
        ratingAverage={product.ratingAverage}
        ratingCount={product.ratingCount ?? 0}
      />
    </div>
  );
}
