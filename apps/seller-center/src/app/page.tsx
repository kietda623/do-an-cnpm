"use client";
import Link from "next/link";
import { useSession } from "@marketplace/ui-web";
export default function HomePage() {
  const { user } = useSession();
  return (
    <main className="mx-auto max-w-5xl px-[var(--space-page-gutter)] py-8">
      {user ? (
        <>
          <h1 className="text-3xl font-semibold">Seller Center</h1>
          <p>Quản lý cửa hàng hoặc gửi hồ sơ đăng ký người bán.</p>
          <Link className="underline" href="/shops">
            Đến cửa hàng của tôi
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Seller Center</h1>
          <p>Đăng nhập để tiếp tục quản lý cửa hàng.</p>
          <Link className="underline" href="/login">
            Đăng nhập người bán
          </Link>
        </>
      )}
    </main>
  );
}
