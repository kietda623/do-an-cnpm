"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WebSession, type ApiPath } from "@marketplace/api-client";

type Product = {
  id: string;
  name: string;
  description: string;
  minimumPrice: string;
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
const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")}₫`;

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
  }, [productId]);
  if (loading)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" role="status">
        Đang tải sản phẩm…
      </main>
    );
  if (error || !product)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div role="alert" className="rounded-xl border p-8">
          Sản phẩm không tồn tại hoặc hiện không được bán công khai.{" "}
          <Link className="underline" href="/products">
            Quay lại danh sách
          </Link>
        </div>
      </main>
    );
  const selected =
    product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
  const image = product.images[imageIndex];
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
      <section aria-label="Thư viện ảnh sản phẩm" className="space-y-3">
        <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-100">
          {image && (
            <img src={image.url} alt={product.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {product.images.map((item, index) => (
            <button
              key={item.url}
              aria-label={`Xem ảnh ${index + 1}`}
              aria-pressed={imageIndex === index}
              onClick={() => setImageIndex(index)}
              className="h-16 w-16 shrink-0 overflow-hidden rounded border-2 aria-pressed:border-marketplace-accent"
            >
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-5">
        <div>
          <p className="text-sm text-neutral-600">Cửa hàng</p>
          <Link className="underline" href={`/shops/${product.shop.id}`}>
            {product.shop.name}
          </Link>
        </div>
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <p className="text-2xl font-semibold text-marketplace-accent">
          {money(selected?.price ?? product.minimumPrice)}
        </p>
        <label className="block font-medium">
          Phân loại
          <select
            aria-label="Phân loại sản phẩm"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border px-3"
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {Object.values(variant.attributes).join(" / ") || variant.sku} ·{" "}
                {money(variant.price)}
              </option>
            ))}
          </select>
        </label>
        <p aria-live="polite" className="text-sm">
          {selected?.availableQuantity
            ? `Còn ${selected.availableQuantity} sản phẩm`
            : "Tạm hết hàng"}
        </p>
        <Link
          href={`/login?returnTo=${encodeURIComponent(`/products/${product.id}`)}`}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-marketplace-accent px-5 font-semibold text-white"
        >
          Đăng nhập để mua
        </Link>
        <section>
          <h2 className="mb-2 text-lg font-semibold">Mô tả</h2>
          <p className="whitespace-pre-wrap leading-7">{product.description}</p>
        </section>
      </section>
    </main>
  );
}
