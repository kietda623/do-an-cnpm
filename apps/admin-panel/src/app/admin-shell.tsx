"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  ConsoleShell,
  LayoutDashboard,
  Package,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Shield,
  ShieldAlert,
  Skeleton,
  Store,
  Tags,
  useApi,
  type ConsoleNavGroup,
} from "@marketplace/ui-web";

const navigation: ConsoleNavGroup[] = [
  {
    items: [
      { href: "/", label: "Tổng quan", icon: <LayoutDashboard size={18} />, exact: true },
      { href: "/users", label: "Người dùng", icon: <Shield size={18} /> },
      { href: "/shops", label: "Duyệt cửa hàng", icon: <Store size={18} /> },
      { href: "/products", label: "Kiểm duyệt sản phẩm", icon: <Package size={18} /> },
      { href: "/categories", label: "Quản lý danh mục", icon: <Tags size={18} /> },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { href: "/orders", label: "Tra cứu đơn hàng", icon: <ReceiptText size={18} /> },
      { href: "/orders/returns", label: "Xác nhận hàng hoàn về", icon: <RotateCcw size={18} /> },
      { href: "/audit", label: "Nhật ký quản trị", icon: <ScrollText size={18} /> },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useApi();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (status === "anonymous" && !isLoginPage) router.replace("/login");
  }, [isLoginPage, router, status]);

  if (isLoginPage) return <>{children}</>;

  if (status === "loading" || status === "anonymous") {
    return (
      <main className="mp-console-boot" role="status">
        <span className="mp-visually-hidden">
          Đang khôi phục phiên quản trị…
        </span>
        <Skeleton className="mp-skeleton--cell" />
        <Skeleton className="mp-skeleton--block" />
      </main>
    );
  }

  if (!user?.roles.includes("ADMIN")) {
    return (
      <main className="mp-console-boot">
        <div className="mp-alert mp-alert--error" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <div className="mp-alert__body">
            <p className="mp-alert__title">Không có quyền quản trị</p>
            <div className="mp-alert__text">
              Tài khoản hiện tại không được cấp quyền vào bảng điều khiển quản
              trị.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ConsoleShell
      product="Marketplace Admin"
      homeHref="/"
      brandIcon={<Shield size={20} />}
      navGroups={navigation}
      topbar={
        <div className="mp-console__context">
          <span className="mp-console__context-name">Vận hành Marketplace</span>
          <span className="mp-console__eyebrow">Quản trị nền tảng</span>
        </div>
      }
    >
      {children}
    </ConsoleShell>
  );
}
