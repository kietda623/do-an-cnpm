"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleGate, useSession } from "@marketplace/ui-web";
import {
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type AdminStats = {
  userCount: number;
  shopCount: number;
  productCount: number;
  orderCount: number;
  completedSellerOrderValue: string;
  simulated: true;
  from: string;
  to: string;
  countsByStatus: Record<string, Record<string, number>>;
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
export default function HomePage() {
  const { user } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void api
        .request<AdminStats>("/admin/stats" as ApiPath)
        .then(setStats)
        .catch((cause: unknown) => setError(normalizeFormError(cause)));
  }, [user]);
  return (
    <main className="mx-auto max-w-5xl px-[var(--space-page-gutter)] py-8">
      {user ? (
        <RoleGate role="ADMIN">
          <h1 className="text-3xl font-semibold">Marketplace Admin</h1>
          <p>Không gian quản trị Marketplace.</p>
          <Link className="underline" href="/shipments">
            Tra cứu và xác nhận hàng hoàn
          </Link>
          {stats && (
            <section
              aria-label="Thống kê nền tảng"
              className="my-6 grid gap-3 rounded border p-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <p>
                Người dùng: <strong>{stats.userCount}</strong>
              </p>
              <p>
                Cửa hàng: <strong>{stats.shopCount}</strong>
              </p>
              <p>
                Sản phẩm: <strong>{stats.productCount}</strong>
              </p>
              <p>
                Đơn hàng: <strong>{stats.orderCount}</strong>
              </p>
              <p className="sm:col-span-2">
                Giá trị seller order hoàn tất:{" "}
                <strong>{stats.completedSellerOrderValue} VND</strong>
              </p>
              <p className="sm:col-span-2 rounded bg-amber-100 p-2">
                Số liệu mô phỏng ·{" "}
                {new Date(stats.from).toLocaleDateString("vi-VN")} –{" "}
                {new Date(stats.to).toLocaleDateString("vi-VN")}
              </p>
              <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
                <h2 className="font-semibold">Số lượng theo trạng thái</h2>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(stats.countsByStatus).map(
                    ([entity, values]) => (
                      <p key={entity}>
                        <strong>{entity}:</strong>{" "}
                        {Object.entries(values)
                          .map(([status, count]) => `${status} ${count}`)
                          .join(" · ") || "chưa có bản ghi"}
                      </p>
                    ),
                  )}
                </div>
              </div>
            </section>
          )}
          {error && <p role="alert">{error}</p>}
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
