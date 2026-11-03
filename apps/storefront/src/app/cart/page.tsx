"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  PageHeader,
  ShoppingCart,
  StatusMessage,
  formatVnd,
  useApi,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../../lib/session";
import { CartGroupView, type CartItemViewModel } from "../../features/cart/cart-view";

type CartItem = CartItemViewModel;
type Cart = {
  groups: Array<{ shopId: string; shopName: string; items: CartItem[]; selectedSubtotal: string }>;
  selectedTotal: string;
  currency: string;
};

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status } = useApi();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login?returnTo=%2Fcart");
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    void webSession.api
      .request<Cart>("/cart")
      .then((nextCart) => {
        if (!live) return;
        setCart(nextCart);
        queryClient.setQueryData(["cart", user?.id], nextCart);
      })
      .catch((cause) => {
        if (!live) return;
        if (cause instanceof ApiClientError && cause.status === 401) {
          router.replace("/login?returnTo=%2Fcart");
          return;
        }
        setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [queryClient, router, status, user?.id]);

  async function update(item: CartItem, changes: { quantity?: number; selected?: boolean }) {
    setPending(true);
    setError("");
    try {
      const nextCart = await webSession.api.request<Cart>(`/cart/items/${item.id}` as ApiPath, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setCart(nextCart);
      queryClient.setQueryData(["cart", user?.id], nextCart);
      window.dispatchEvent(new Event("marketplace:cart-changed"));
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }
  async function remove(item: CartItem) {
    setPending(true);
    setError("");
    try {
      await webSession.api.request<void>(`/cart/items/${item.id}` as ApiPath, { method: "DELETE" });
      const nextCart = await webSession.api.request<Cart>("/cart");
      setCart(nextCart);
      queryClient.setQueryData(["cart", user?.id], nextCart);
      window.dispatchEvent(new Event("marketplace:cart-changed"));
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  if (loading)
    return (
      <div className="mp-container mp-cart" aria-busy="true">
        <PageHeader title="Giỏ hàng" />
        <span className="mp-skeleton mp-cart__skeleton" />
        <p className="mp-visually-hidden" role="status">
          Đang tải giỏ hàng…
        </p>
      </div>
    );

  const itemCount =
    cart?.groups.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  return (
    <div className="mp-container mp-cart">
      <PageHeader
        title="Giỏ hàng"
        description="Kiểm tra số lượng và chọn sản phẩm trước khi tạo báo giá."
        actions={
          <Link className="mp-button mp-button--secondary" href="/products">
            Tiếp tục mua sắm
          </Link>
        }
        meta={
          itemCount > 0 ? (
            <span>
              {itemCount} sản phẩm · {cart?.groups.length ?? 0} cửa hàng
            </span>
          ) : undefined
        }
      />

      {error && (
        <StatusMessage
          tone="error"
          title="Không cập nhật được giỏ hàng"
          onDismiss={() => setError("")}
        >
          {error}
        </StatusMessage>
      )}

      {itemCount === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={22} />}
          title="Giỏ hàng đang trống."
          description="Thêm sản phẩm từ cửa hàng yêu thích để bắt đầu đơn hàng."
          action={
            <Link className="mp-button mp-button--primary" href="/products">
              Khám phá sản phẩm
            </Link>
          }
        />
      ) : (
        <div className="mp-cart__layout">
          <div className="mp-cart__groups">
            {cart?.groups.map((group) => (
              <CartGroupView
                key={group.shopId}
                group={group}
                disabled={pending}
                onUpdate={(item, changes) => void update(item, changes)}
                onRemove={(item) => void remove(item)}
              />
            ))}
          </div>
          <aside className="mp-cart__summary" aria-label="Tóm tắt đơn hàng">
            <h2>Tạm tính</h2>
            <dl>
              <div>
                <dt>Tổng đã chọn</dt>
                <dd data-numeric>{formatVnd(cart?.selectedTotal)}</dd>
              </div>
            </dl>
            <Link
              aria-disabled={cart?.selectedTotal === "0"}
              className={`mp-button mp-button--primary mp-button--lg mp-button--block${
                cart?.selectedTotal === "0" ? " mp-button--disabled" : ""
              }`}
              href="/checkout"
            >
              Tiến hành đặt hàng
            </Link>
            <p className="mp-cart__note">
              Giá và tồn kho sẽ được xác nhận lại khi tạo báo giá. Báo giá có hiệu lực trong
              thời gian ngắn.
            </p>
            <ul className="mp-cart__assurances">
              <li>Hủy riêng từng cửa hàng khi chưa xác nhận</li>
              <li>Theo dõi vận chuyển theo từng kiện</li>
              <li>Thanh toán COD hoặc mô phỏng</li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
