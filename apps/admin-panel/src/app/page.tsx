"use client";
import Link from "next/link";
import { RoleGate, useSession } from "@marketplace/ui-web";
export default function HomePage() {
  const { user } = useSession();
  return (
    <main className="mx-auto max-w-5xl px-[var(--space-page-gutter)] py-8">
      {user ? (
        <RoleGate role="ADMIN">
          <h1 className="text-3xl font-semibold">Marketplace Admin</h1>
          <p>Không gian quản trị Marketplace.</p>
          <Link className="underline" href="/shops">
            Duyệt cửa hàng
          </Link>
          <Link className="underline" href="/categories">
            Quản lý danh mục
          </Link>
        </RoleGate>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Marketplace Admin</h1>
          <p>Đăng nhập bằng tài khoản quản trị.</p>
          <Link className="underline" href="/login">
            Đăng nhập quản trị
          </Link>
        </>
      )}
    </main>
  );
}
