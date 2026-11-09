"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { normalizeFormError } from "@marketplace/api-client";
import { useApi } from "@marketplace/ui-web";

type Category = { id: string; name: string; children?: Category[] };

const flatten = (items: Category[]): Category[] =>
  items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

export function CategoryStrip() {
  const { api, status } = useApi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    let live = true;
    setError("");
    void api
      .request<Category[]>("/categories")
      .then((value) => {
        if (live) setCategories(flatten(value).slice(0, 12));
      })
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api, attempt, status]);

  if (error)
    return (
      <p className="mp-alert-inline" role="alert">
        Không tải được danh mục. {error}{" "}
        <button
          type="button"
          className="mp-link"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Thử lại
        </button>
      </p>
    );

  if (categories.length === 0) return null;

  return (
    <section
      className="mp-market-categories"
      aria-labelledby="market-categories-heading"
    >
      <h2 id="market-categories-heading">Danh mục</h2>
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
    </section>
  );
}
