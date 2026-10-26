"use client";

import Link from "next/link";
import { useSession } from "@marketplace/ui-web";

export function AdminNavigation() {
  const { user } = useSession();
  if (!user?.roles.includes("ADMIN")) return null;
  return (
    <nav aria-label="Điều hướng Admin" className="border-b px-6 py-3">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2">
        <Link className="underline" href="/">
          Tổng quan
        </Link>
        <Link className="underline" href="/users">
          Người dùng
        </Link>
        <Link className="underline" href="/shops">
          Duyệt cửa hàng
        </Link>
        <Link className="underline" href="/products">
          Kiểm duyệt sản phẩm
        </Link>
        <Link className="underline" href="/orders">
          Tra cứu đơn hàng
        </Link>
        <Link className="underline" href="/audit">
          Nhật ký quản trị
        </Link>
        <Link className="underline" href="/orders/returns">
          Xác nhận hàng hoàn về
        </Link>
        <Link className="underline" href="/categories">
          Quản lý danh mục
        </Link>
      </div>
    </nav>
  );
}
