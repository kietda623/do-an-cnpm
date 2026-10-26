"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "ACTIVE" | "LOCKED";
  version: number;
  roles: string[];
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string, init?: RequestInit) =>
  api.request<T>(path as ApiPath, init);

export default function AdminUsersPage() {
  const { user } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{
    target: AdminUser;
    action: "lock" | "unlock";
  } | null>(null);
  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const result = await request<AdminUser[]>(`/admin/users?${params}`);
    setUsers(result);
  }, [q, status]);
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, refresh]);
  async function changeState(target: AdminUser, action: "lock" | "unlock") {
    setBusy(target.id);
    setError("");
    try {
      await request(`/admin/users/${target.id}/${action}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          reason: reason[target.id]?.trim(),
          expectedVersion: target.version,
        }),
      });
      setPending(null);
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "Tài khoản vừa thay đổi. Danh sách đã tải lại; hãy kiểm tra phiên bản mới.",
        );
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy("");
    }
  }
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để xem tài khoản.</p>
        <Link href="/login">Đăng nhập</Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền quản trị người dùng.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Quản lý người dùng</h1>
        <p>{users.length} kết quả</p>
      </header>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <label className="grid gap-1">
          Tìm kiếm
          <input
            aria-label="Tìm kiếm người dùng"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Trạng thái
          <select
            aria-label="Lọc trạng thái người dùng"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded border p-2"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOCKED">LOCKED</option>
          </select>
        </label>
        <button className="self-end rounded border px-4 py-2">Tìm</button>
      </form>
      {users.map((target) => (
        <article
          key={target.id}
          className="grid gap-3 rounded border p-4 md:grid-cols-[1fr_auto]"
        >
          <div>
            <h2 className="text-xl font-semibold">{target.fullName}</h2>
            <p>
              {target.email} · {target.status} · version {target.version}
            </p>
            <p>{target.phone ?? "Chưa có số điện thoại"}</p>
          </div>
          <div className="flex items-start gap-2">
            {target.status === "ACTIVE" ? (
              <button
                disabled={busy === target.id}
                onClick={() => setPending({ target, action: "lock" })}
                className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
              >
                Khóa
              </button>
            ) : (
              <button
                disabled={busy === target.id}
                onClick={() => setPending({ target, action: "unlock" })}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                Mở khóa
              </button>
            )}
          </div>
        </article>
      ))}
      {pending && (
        <dialog
          open
          aria-labelledby="user-state-dialog-title"
          className="fixed inset-0 m-auto w-[min(92vw,34rem)] rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
        >
          <h2 id="user-state-dialog-title" className="text-xl font-semibold">
            {pending.action === "lock" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          </h2>
          <p>
            {pending.target.email} · version {pending.target.version}
          </p>
          <label className="my-4 grid gap-1">
            Lý do xử lý
            <textarea
              aria-label={`Lý do ${pending.target.email}`}
              required
              minLength={1}
              maxLength={500}
              value={reason[pending.target.id] ?? ""}
              onChange={(event) =>
                setReason((current) => ({
                  ...current,
                  [pending.target.id]: event.target.value,
                }))
              }
              className="rounded border p-2"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPending(null)}
              className="rounded border px-4 py-2"
            >
              Hủy
            </button>
            <button
              disabled={
                busy === pending.target.id || !reason[pending.target.id]?.trim()
              }
              onClick={() => void changeState(pending.target, pending.action)}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Xác nhận {pending.action === "lock" ? "khóa" : "mở khóa"}
            </button>
          </div>
        </dialog>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
