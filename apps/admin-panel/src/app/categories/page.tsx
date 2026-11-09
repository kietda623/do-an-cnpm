"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, useApi } from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { CategoryEditor, type CategoryRow } from "../../features/categories/category-editor";

export default function CategoriesPage() {
  const { api } = useApi();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setRows(await api.request<CategoryRow[]>("/admin/categories" as ApiPath));
      setError("");
    } catch (cause) {
      setError(normalizeFormError(cause));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(
    input: { name: string; parentId: string | null; visible: boolean },
    row?: CategoryRow,
  ) {
    try {
      const path = row ? `/admin/categories/${row.id}` : "/admin/categories";
      await api.request(path as ApiPath, {
        method: row ? "PATCH" : "POST",
        body: JSON.stringify(row ? { ...input, expectedVersion: row.version } : input),
      });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Danh mục vừa được cập nhật. Đã tải lại cây danh mục.");
        await refresh();
        return;
      }
      throw cause;
    }
  }

  return (
    <div className="mp-page mp-admin-page">
      <PageHeader
        title="Quản lý danh mục"
        description="Dựng cây danh mục dùng chung cho toàn Marketplace và ẩn những nhánh ngừng sử dụng."
      />
      <CategoryEditor rows={rows} onSave={save} />
      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}
    </div>
  );
}
