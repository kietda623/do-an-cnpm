"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";
import { CategoryEditor, type CategoryRow } from "../../features/categories/category-editor";
const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;
const request = <T,>(path: string, init?: RequestInit) => api.request<T>(path as ApiPath, init);
export default function CategoriesPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<CategoryRow[]>([]),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setRows(await request<CategoryRow[]>("/admin/categories"));
      setError("");
    } catch (e) {
      setError(normalizeFormError(e));
    }
  }, []);
  useEffect(() => {
    if (user?.roles.includes("ADMIN")) void refresh();
  }, [user, refresh]);
  async function save(
    input: { name: string; parentId: string | null; visible: boolean },
    row?: CategoryRow,
  ) {
    try {
      const path = row ? `/admin/categories/${row.id}` : "/admin/categories";
      await request(path, {
        method: row ? "PATCH" : "POST",
        body: JSON.stringify(row ? { ...input, expectedVersion: row.version } : input),
      });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Danh mục vừa được cập nhật. Đã tải lại cây danh mục.");
        await refresh();
      } else throw cause;
    }
  }
  if (!user)
    return (
      <main className="p-8">
        <h1>Danh mục</h1>
        <p>Đăng nhập quản trị để tiếp tục.</p>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền quản trị danh mục.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-5xl gap-5 p-8">
      <h1 className="text-2xl font-bold">Quản lý danh mục</h1>
      <CategoryEditor rows={rows} onSave={save} />
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
