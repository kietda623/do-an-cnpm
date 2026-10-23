"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, type SessionUser } from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../auth-form";
import { CartGroupView, type CartItemViewModel } from "../../features/cart/cart-view";
import { formatVnd } from "../../features/money";

type CartItem = CartItemViewModel;
type Cart = {
  groups: Array<{ shopId: string; shopName: string; items: CartItem[]; selectedSubtotal: string }>;
  selectedTotal: string;
  currency: string;
};

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const currentUser = user ?? (await webSession.restore<SessionUser>());
      if (!user) setUser(currentUser);
      const nextCart = await webSession.api.request<Cart>("/cart");
      setCart(nextCart);
      queryClient.setQueryData(["cart", currentUser.id], nextCart);
    } catch {
      await webSession.clear();
      router.replace("/login?returnTo=%2Fcart");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [queryClient, router, setUser, user]);

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
      await queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      await load();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }
  if (loading)
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p role="status">Đang tải giỏ hàng…</p>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-600">Mua sắm</p>
          <h1 className="text-3xl font-bold">Giỏ hàng</h1>
        </div>
        <Link className="underline" href="/products">
          Tiếp tục mua sắm
        </Link>
      </header>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!cart?.groups.some((group) => group.items.length) ? (
        <p className="rounded-xl border p-8 text-center">Giỏ hàng đang trống.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {cart.groups.map((group) => (
              <CartGroupView
                key={group.shopId}
                group={group}
                disabled={pending}
                onUpdate={(item, changes) => void update(item, changes)}
                onRemove={(item) => void remove(item)}
              />
            ))}
          </div>
          <aside className="h-fit space-y-4 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Tạm tính</h2>
            <p className="flex justify-between">
              <span>Tổng đã chọn</span>
              <strong>{formatVnd(cart.selectedTotal)}</strong>
            </p>
            <Link
              aria-disabled={cart.selectedTotal === "0"}
              className={`flex min-h-11 items-center justify-center rounded-lg bg-marketplace-accent px-4 font-semibold text-white ${cart.selectedTotal === "0" ? "pointer-events-none opacity-50" : ""}`}
              href="/checkout"
            >
              Tiến hành đặt hàng
            </Link>
            <p className="text-xs text-neutral-600">
              Giá và tồn kho sẽ được xác nhận lại khi tạo báo giá.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
