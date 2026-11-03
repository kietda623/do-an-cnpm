"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type ApiPath } from "@marketplace/api-client";
import { useApi } from "@marketplace/ui-web";

type Category = { id: string; name: string; children?: Category[] };

const flatten = (items: Category[]): Category[] =>
  items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

export function CategoryStrip() {
  const { api, status } = useApi();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    void api
      .request<Category[]>("/categories" as ApiPath)
      .then((value) => {
        if (live) setCategories(flatten(value).slice(0, 12));
      })
      .catch(() => {
        if (live) setCategories([]);
      });
    return () => {
      live = false;
    };
  }, [api, status]);

  if (categories.length === 0) return null;

  return (
    <nav className="mp-chips" aria-label="Danh mục sản phẩm">
      <Link className="mp-chip" href="/products">
        Tất cả sản phẩm
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          className="mp-chip"
          href={`/products?categoryId=${encodeURIComponent(category.id)}`}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
