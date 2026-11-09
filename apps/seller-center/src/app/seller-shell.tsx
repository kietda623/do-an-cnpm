"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { normalizeFormError } from "@marketplace/api-client";
import {
  ChartLine,
  ConsoleShell,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Skeleton,
  Star,
  Store,
  useApi,
  type ConsoleNavGroup,
} from "@marketplace/ui-web";
import type { Membership } from "../lib/types";

function currentShopId(pathname: string): string | undefined {
  const match = /^\/shops\/([^/]+)/.exec(pathname);
  return match?.[1];
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { api, status } = useApi();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipError, setMembershipError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (status !== "authenticated" || isAuthPage) return;
    let live = true;
    setMembershipError("");
    void api
      .request<Membership[]>("/users/me/shops")
      .then((rows) => {
        if (live) setMemberships(rows);
      })
      .catch((cause: unknown) => {
        if (live) setMembershipError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api, attempt, isAuthPage, status]);

  useEffect(() => {
    if (status === "anonymous" && !isAuthPage) router.replace("/login");
  }, [isAuthPage, router, status]);

  if (isAuthPage) return <div className="mp-seller-auth">{children}</div>;

  if (status === "loading" || status === "anonymous") {
    return (
      <main className="mp-console-boot" role="status">
        <span className="mp-visually-hidden">
          Đang khôi phục phiên đăng nhập…
        </span>
        <Skeleton className="mp-skeleton--cell" />
        <Skeleton className="mp-skeleton--block" />
      </main>
    );
  }

  const activeShopId = currentShopId(pathname) ?? memberships[0]?.shopId;
  const activeShop = memberships.find((row) => row.shopId === activeShopId);

  const navGroups: ConsoleNavGroup[] = [
    {
      label: "Cửa hàng",
      items: [
        {
          href: "/shops",
          label: "Đến cửa hàng của tôi",
          icon: <Store size={18} />,
          exact: true,
        },
      ],
    },
  ];

  if (activeShopId) {
    const base = `/shops/${activeShopId}`;
    navGroups.push({
      label: activeShop?.shopName ?? "Quản lý",
      items: [
        {
          href: `${base}/dashboard`,
          label: "Tổng quan",
          icon: <LayoutDashboard size={18} />,
        },
        {
          href: `${base}/orders`,
          label: "Đơn hàng",
          icon: <ReceiptText size={18} />,
        },
        {
          href: `${base}/products`,
          label: "Sản phẩm",
          icon: <Package size={18} />,
        },
        {
          href: `${base}/analytics`,
          label: "Doanh thu",
          icon: <ChartLine size={18} />,
        },
        {
          href: `${base}/reviews`,
          label: "Đánh giá",
          icon: <Star size={18} />,
        },
        {
          href: `${base}/settings`,
          label: "Cài đặt cửa hàng",
          icon: <Settings size={18} />,
        },
      ],
    });
  }

  const switcher =
    memberships.length > 1 ? (
      <label className="mp-switcher">
        <span className="mp-visually-hidden">Chọn cửa hàng</span>
        <select
          className="mp-switcher__select"
          value={activeShopId ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            if (!next) return;
            router.push(`/shops/${next}/dashboard`);
          }}
        >
          {memberships.map((row) => (
            <option key={row.shopId} value={row.shopId}>
              {row.shopName}
            </option>
          ))}
        </select>
      </label>
    ) : undefined;

  return (
    <ConsoleShell
      product="Seller Center"
      homeHref="/shops"
      brandIcon={<Store size={20} />}
      navGroups={navGroups}
      shopSwitcher={switcher}
      topbar={
        <div className="mp-console__context">
          <span className="mp-console__eyebrow">Kênh người bán</span>
          <span className="mp-console__context-name">
            {activeShop?.shopName ?? "Chọn cửa hàng để bắt đầu"}
          </span>
        </div>
      }
    >
      {membershipError && (
        <p className="mp-alert-inline" role="alert">
          Không tải được danh sách cửa hàng. {membershipError}{" "}
          <button
            type="button"
            className="mp-link"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      <div className="mp-seller-workspace">{children}</div>
    </ConsoleShell>
  );
}
