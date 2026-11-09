"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  PageHeader,
  Panel,
  SelectField,
  Skeleton,
  Store,
  useApi,
  usePolling,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { Membership, Shop } from "../../lib/types";
import { ShopOverview, ShopStatusActions } from "../../features/shop/shop-overview";
import { ShopProfileForm } from "../../features/shop/shop-profile-form";
import { ShopRegisterForm } from "../../features/shop/shop-register-form";

export default function ShopsPage() {
  const { api, status } = useApi();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const rows = await api.request<Membership[]>("/users/me/shops" as ApiPath);
    setMemberships(rows);
    const selected = rows[0];
    setShop(selected ? await api.request<Shop>(`/shops/${selected.shopId}/management` as ApiPath) : null);
  }, [api]);

  const shopId = shop?.id;
  const pollShop = useCallback(async () => {
    if (!shopId) return;
    setShop(await api.request<Shop>(`/shops/${shopId}/management` as ApiPath));
  }, [api, shopId]);

  usePolling(pollShop, {
    intervalMs: shop?.status === "PENDING" ? 30_000 : 60_000,
    enabled: status === "authenticated" && shop !== null,
    pauseWhile: busy || selecting,
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    let live = true;
    setLoading(true);
    setError("");
    void refresh()
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [refresh, status]);

  async function selectShop(shopId: string) {
    setSelecting(true);
    setError("");
    try {
      setShop(await api.request<Shop>(`/shops/${shopId}/management` as ApiPath));
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setSelecting(false);
    }
  }

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
    <div className="mp-page mp-seller-page mp-seller-shop-profile">
      <PageHeader
        title="Cửa hàng của tôi"
        description="Đăng ký mở gian hàng, theo dõi trạng thái duyệt và cập nhật hồ sơ công khai."
      />

      {loading ? (
        <div className="mp-page" role="status">
          <span className="mp-visually-hidden">Đang tải cửa hàng…</span>
          <Skeleton className="mp-skeleton--block" />
        </div>
      ) : error && !shop ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : !shop ? (
        <>
          <EmptyState
            icon={<Store size={22} />}
            title="Bạn chưa có cửa hàng nào."
            description="Gửi hồ sơ đăng ký bên dưới để bắt đầu bán hàng trên sopi."
          />
          <ShopRegisterForm
            onCreated={async () => {
              setNotice("Đã gửi hồ sơ cửa hàng. Hồ sơ đang chờ quản trị viên duyệt.");
              await refresh();
            }}
          />
        </>
      ) : (
        <>
          {memberships.length > 1 ? (
            <Panel title="Chọn cửa hàng">
              <SelectField
                label="Cửa hàng đang quản lý"
                value={shop.id}
                disabled={selecting}
                onChange={(event) => void selectShop(event.target.value)}
              >
                {memberships.map((row) => (
                  <option key={row.shopId} value={row.shopId}>
                    {row.shopName}
                  </option>
                ))}
              </SelectField>
            </Panel>
          ) : null}

          <ShopOverview shop={shop} />

          {shop.status === "PENDING" ? (
            <p className="mp-notice-inline">
              Hồ sơ cửa hàng đang chờ quản trị viên duyệt. Bạn có thể chuẩn bị sản phẩm sau khi cửa
              hàng được kích hoạt.
            </p>
          ) : null}

          <ShopStatusActions shop={shop} busy={busy} onResubmit={() => void resubmit()} />

          {shop.status !== "SUSPENDED" ? (
            <ShopProfileForm
              shop={shop}
              onSaved={async () => {
                setNotice("Đã lưu thông tin cửa hàng.");
                await refresh();
              }}
            />
          ) : null}
        </>
      )}

      {notice ? (
        <p className="mp-notice-inline" role="status">
          {notice}
        </p>
      ) : null}
      {error && shop ? (
        <p className="mp-alert-inline" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
