"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  PageHeader,
  Panel,
  Skeleton,
  StatusMessage,
  Store,
  useApi,
  usePolling,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { Shop } from "../../../../lib/types";
import { ShopOverview, ShopStatusActions } from "../../../../features/shop/shop-overview";
import { ShopProfileForm } from "../../../../features/shop/shop-profile-form";

export default function ShopSettingsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api } = useApi();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        setShop(await api.request<Shop>(`/shops/${shopId}/management` as ApiPath));
      } catch (cause) {
        if (!silent) setError(normalizeFormError(cause));
        throw cause;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, shopId],
  );

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  usePolling(refresh, {
    intervalMs: shop?.status === "PENDING" ? 30_000 : 60_000,
    pauseWhile: busy,
  });

  async function resubmit() {
    if (!shop) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.request<Shop>(`/shops/${shop.id}/resubmit` as ApiPath, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: shop.version }),
      });
      setNotice("Đã gửi lại hồ sơ để duyệt.");
      await refresh();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mp-page">
      <PageHeader
        title="Cài đặt cửa hàng"
        description="Hồ sơ công khai, ảnh thương hiệu và trạng thái duyệt của gian hàng."
        actions={
          <Link className="mp-button mp-button--secondary mp-button--md" href={`/shops/${shopId}/dashboard`}>
            <span className="mp-button__label">Về tổng quan</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      {notice ? (
        <StatusMessage tone="success" title="Đã gửi hồ sơ" onDismiss={() => setNotice("")}>
          <p>{notice}</p>
        </StatusMessage>
      ) : null}

      {loading && !shop ? (
        <div className="mp-page" role="status">
          <span className="mp-visually-hidden">Đang tải thông tin cửa hàng…</span>
          <Skeleton className="mp-skeleton--block" />
          <Skeleton className="mp-skeleton--block" />
        </div>
      ) : error && !shop ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : shop ? (
        <>
          <ShopOverview shop={shop} />
          <ShopStatusActions shop={shop} busy={busy} onResubmit={() => void resubmit()} />
          {shop.status === "SUSPENDED" ? (
            <Panel title="Hồ sơ chỉ đọc" description="Cửa hàng đang tạm ngưng nên không thể chỉnh sửa hồ sơ.">
              <p className="mp-muted">
                <Store size={16} aria-hidden="true" /> Liên hệ quản trị viên để được mở lại gian hàng.
              </p>
            </Panel>
          ) : (
            <ShopProfileForm
              shop={shop}
              onSaved={async () => {
                setNotice("Đã lưu thông tin cửa hàng.");
                await refresh();
              }}
            />
          )}
          {error ? (
            <p role="alert" className="mp-alert-inline">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
