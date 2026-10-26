"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type Audit = {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string | null;
  requestId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string) => api.request<T>(path as ApiPath);

export default function AdminAuditPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Audit[]>([]);
  const [resourceType, setResourceType] = useState("");
  const [actorId, setActorId] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (resourceType.trim()) params.set("resourceType", resourceType.trim());
    if (actorId.trim()) params.set("actorId", actorId.trim());
    setRows(await request<Audit[]>(`/admin/audit?${params}`));
  }, [resourceType, actorId]);
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, refresh]);
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để xem audit.</p>
        <Link href="/login">Đăng nhập</Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền xem nhật ký quản trị.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Nhật ký quản trị</h1>
        <p>Nhật ký bất biến, chỉ hiển thị metadata an toàn.</p>
      </header>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <label className="grid gap-1">
          Loại tài nguyên
          <input
            aria-label="Lọc loại tài nguyên"
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Actor ID
          <input
            aria-label="Actor ID"
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <button className="self-end rounded border px-4 py-2">Lọc</button>
      </form>
      {rows.map((row) => (
        <article key={row.id} className="rounded border p-4">
          <h2 className="font-semibold">{row.action}</h2>
          <p>
            {row.resourceType} {row.resourceId} · actor{" "}
            {row.actorId ?? "system"}
          </p>
          <p>
            {row.reason ?? "Không có lý do"} ·{" "}
            {new Date(row.createdAt).toLocaleString("vi-VN")}
          </p>
          <p>Request {row.requestId}</p>
          <pre className="overflow-auto rounded bg-neutral-100 p-2 text-sm">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </article>
      ))}
      {rows.length === 0 && !error && <p>Chưa có bản ghi phù hợp.</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
