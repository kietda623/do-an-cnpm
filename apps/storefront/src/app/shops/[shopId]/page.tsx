"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { WebSession, type ApiPath } from "@marketplace/api-client";
import { ProductGrid } from "../../../features/discovery/product-grid";

type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: { url: string } | null;
  banner: { url: string } | null;
};
const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;

export default function PublicShopPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void api
      .request<Shop>(`/shops/${shopId}` as ApiPath)
      .then((value) => {
        if (live) setShop(value);
      })
      .catch(() => {
        if (live) setShop(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [shopId]);
  if (loading)
    return (
      <main className="mx-auto max-w-7xl px-4 py-10" role="status">
        Đang tải cửa hàng…
      </main>
    );
  if (!shop)
    return (
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-10">
        <div role="alert" className="rounded-xl border p-8">
          Cửa hàng không tồn tại hoặc chưa mở bán.
        </div>
        <Link className="underline" href="/products">
          Khám phá sản phẩm
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8">
      <header className="overflow-hidden rounded-2xl border bg-white">
        <div className="h-36 bg-neutral-100 sm:h-52">
          {shop.banner && (
            <img src={shop.banner.url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex items-center gap-4 p-5">
          {shop.logo && (
            <img
              src={shop.logo.url}
              alt=""
              className="h-16 w-16 rounded-full border object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            <p className="text-neutral-600">{shop.description}</p>
          </div>
        </div>
      </header>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sản phẩm của cửa hàng</h2>
        <ProductGrid endpoint={`/shops/${shopId}/products`} />
      </section>
    </main>
  );
}
