"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  WebSession,
  type ApiPath,
} from "@marketplace/api-client";

type Shop = {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string;
  rejectionReason: string | null;
  version: number;
  logo: { url: string };
  createdAt: string;
};
type Page = { data: Shop[]; meta: { total: number; page: number; pageSize: number } };
const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;
const request = <T,>(path: string, init?: RequestInit) => api.request<T>(path as ApiPath, init);

export default function ShopQueuePage() {
  const { user } = useSession();
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  async function refresh() {
    const result = await request<Page>("/admin/shops?page=1&pageSize=50");
    setShops(result.data);
  }
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void refresh().catch((cause: unknown) => setError(normalizeFormError(cause)));
  }, [user]);
  async function act(shop: Shop, action: "approve" | "reject" | "suspend" | "resume") {
    setBusyId(shop.id);
    setError("");
    try {
      const path = `/admin/shops/${shop.id}/${action}`;
      const body =
        action === "approve"
          ? { expectedVersion: shop.version }
          : { expectedVersion: shop.version, reason: reason[shop.id]?.trim() ?? "" };
      await request<Shop>(path, { method: "POST", body: JSON.stringify(body) });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "Hồ sơ vừa được xử lý ở nơi khác. Danh sách đã tải lại; hãy kiểm tra trạng thái mới.",
        );
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusyId("");
    }
  }
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để duyệt cửa hàng.</p>
        <Link className="underline" href="/login">
          Đăng nhập
        </Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền quản trị cửa hàng.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Duyệt cửa hàng</h1>
        <p>{shops.length} hồ sơ</p>
      </div>
      {shops.map((shop) => (
        <article key={shop.id} className="grid gap-3 rounded border p-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">{shop.name}</h2>
            <p>
              {shop.slug} · {shop.status} · phiên bản {shop.version}
            </p>
            <p>{shop.description}</p>
            {shop.rejectionReason && <p>Lý do trước đó: {shop.rejectionReason}</p>}
            <label>
              Lý do xử lý
              <input
                value={reason[shop.id] ?? ""}
                onChange={(event) =>
                  setReason((current) => ({ ...current, [shop.id]: event.target.value }))
                }
                maxLength={500}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {shop.status === "PENDING" && (
              <>
                <button disabled={busyId === shop.id} onClick={() => void act(shop, "approve")}>
                  Duyệt
                </button>
                <button
                  disabled={busyId === shop.id || !reason[shop.id]?.trim()}
                  onClick={() => void act(shop, "reject")}
                >
                  Từ chối
                </button>
              </>
            )}
            {shop.status === "ACTIVE" && (
              <button
                disabled={busyId === shop.id || !reason[shop.id]?.trim()}
                onClick={() => void act(shop, "suspend")}
              >
                Tạm ngưng
              </button>
            )}
            {shop.status === "SUSPENDED" && (
              <button
                disabled={busyId === shop.id || !reason[shop.id]?.trim()}
                onClick={() => void act(shop, "resume")}
              >
                Khôi phục
              </button>
            )}
          </div>
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
