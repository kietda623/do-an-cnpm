"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton, useApi } from "@marketplace/ui-web";
import type { Membership } from "../lib/types";

export default function HomePage() {
  const router = useRouter();
  const { api, status } = useApi();

  useEffect(() => {
    if (status !== "authenticated") return;
    let live = true;
    void api
      .request<Membership[]>("/users/me/shops")
      .then((rows) => {
        if (!live) return;
        router.replace(rows[0] ? `/shops/${rows[0].shopId}/dashboard` : "/shops");
      })
      .catch(() => {
        if (live) router.replace("/shops");
      });
    return () => {
      live = false;
    };
  }, [api, router, status]);

  return (
    <div className="mp-page" role="status">
      <span className="mp-visually-hidden">Đang mở Seller Center…</span>
      <Skeleton className="mp-skeleton--line" />
      <Skeleton className="mp-skeleton--block" />
    </div>
  );
}
