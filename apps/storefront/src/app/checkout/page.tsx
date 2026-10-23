"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, type SessionUser } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";
import { webSession } from "../auth-form";
import { CheckoutConfirm } from "../../features/checkout/checkout-confirm";
import { formatVnd } from "../../features/money";

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
};
type Cart = {
  groups: Array<{
    items: Array<{
      id: string;
      productName: string;
      currentUnitPrice: string;
      quantity: number;
      selected: boolean;
      purchasable: boolean;
    }>;
  }>;
  selectedTotal: string;
};
type Quote = {
  quoteId: string;
  expiresAt: string;
  lines: Array<{ cartItemId: string; lineTotal: string }>;
  total: string;
  valid: boolean;
  issues: Array<{ code: string; message: string }>;
};
type CheckoutRetry = { quote: Quote; idempotencyKey: string };
const retryStorageKey = "marketplace.checkout.retry.v1";

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [buyerId, setBuyerId] = useState(user?.id ?? "");
  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "MOCK">("COD");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentUser = user ?? (await webSession.restore<SessionUser>());
        if (!user) setUser(currentUser);
        setBuyerId(currentUser.id);
        const [savedAddresses, savedCart] = await Promise.all([
          webSession.api.request<Address[]>("/users/me/addresses"),
          webSession.api.request<Cart>("/cart"),
        ]);
        if (active) {
          setAddresses(savedAddresses);
          setCart(savedCart);
          setAddressId(
            savedAddresses.find((item) => item.isDefault)?.id ?? savedAddresses[0]?.id ?? "",
          );
          const pendingCheckout = sessionStorage.getItem(retryStorageKey);
          if (pendingCheckout) {
            try {
              const retry = JSON.parse(pendingCheckout) as CheckoutRetry;
              if (retry.quote?.quoteId && retry.idempotencyKey) {
                setQuote(retry.quote);
                setIdempotencyKey(retry.idempotencyKey);
              }
            } catch {
              sessionStorage.removeItem(retryStorageKey);
            }
          }
        }
      } catch {
        await webSession.clear();
        router.replace("/login?returnTo=%2Fcheckout");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected =
    cart?.groups.flatMap((group) => group.items).filter((item) => item.selected) ?? [];
  function discardQuote() {
    setQuote(null);
    setIdempotencyKey("");
    sessionStorage.removeItem(retryStorageKey);
  }
  async function createQuote() {
    if (!addressId || selected.length === 0) {
      setError("Chọn địa chỉ nhận hàng và ít nhất một sản phẩm.");
      return;
    }
    setPending(true);
    setError("");
    discardQuote();
    try {
      const next = await webSession.api.request<Quote>("/checkout/quotes", {
        method: "POST",
        body: JSON.stringify({
          cartItemIds: selected.map((item) => item.id),
          addressId,
          paymentMethod,
        }),
      });
      setQuote(next);
      if (next.valid) {
        const key = crypto.randomUUID();
        setIdempotencyKey(key);
        sessionStorage.setItem(
          retryStorageKey,
          JSON.stringify({ quote: next, idempotencyKey: key } satisfies CheckoutRetry),
        );
      }
      if (!next.valid) setError(next.issues.map((issue) => issue.message).join(" "));
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }
  async function placeOrder() {
    if (!quote?.valid) return;
    setPending(true);
    setError("");
    try {
      const order = await webSession.api.request<{ id: string }>("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ quoteId: quote.quoteId }),
      });
      sessionStorage.removeItem(retryStorageKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cart", buyerId] }),
        queryClient.invalidateQueries({ queryKey: ["orders", buyerId] }),
      ]);
      router.push(`/orders/${order.id}`);
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }
  if (loading)
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p role="status">Đang tải thông tin thanh toán…</p>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
      <header>
        <p className="text-sm text-neutral-600">Giỏ hàng</p>
        <h1 className="text-3xl font-bold">Thanh toán</h1>
      </header>
      {error && (
        <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-800">
          {error}
        </p>
      )}
      {addresses.length === 0 ? (
        <section className="space-y-3 rounded-xl border p-5">
          <p>Anh chưa có địa chỉ nhận hàng.</p>
          <Link className="underline" href="/account/addresses">
            Thêm địa chỉ
          </Link>
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Địa chỉ nhận hàng</h2>
            <label className="grid gap-2">
              Chọn địa chỉ
              <select
                className="min-h-11 rounded-lg border px-3"
                value={addressId}
                onChange={(event) => {
                  setAddressId(event.target.value);
                  discardQuote();
                }}
              >
                <option value="">Chọn địa chỉ</option>
                {addresses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.recipientName} · {item.phone} — {item.line1}, {item.ward}, {item.district}
                    , {item.province}
                    {item.isDefault ? " (Mặc định)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Link className="text-sm underline" href="/account/addresses">
              Quản lý địa chỉ
            </Link>
          </section>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Sản phẩm</h2>
            {selected.map((item) => (
              <p key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.productName} × {item.quantity}
                  {!item.purchasable ? " · cần kiểm tra tồn kho" : ""}
                </span>
                <strong>
                  {formatVnd((BigInt(item.currentUnitPrice) * BigInt(item.quantity)).toString())}
                </strong>
              </p>
            ))}
            {selected.length === 0 && (
              <p>
                Chưa chọn sản phẩm.{" "}
                <Link className="underline" href="/cart">
                  Quay lại giỏ hàng
                </Link>
              </p>
            )}
          </section>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Phương thức thanh toán</h2>
            <label className="flex gap-2">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "COD"}
                onChange={() => {
                  setPaymentMethod("COD");
                  discardQuote();
                }}
              />{" "}
              Thanh toán khi nhận hàng
            </label>
            <label className="flex gap-2">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "MOCK"}
                onChange={() => {
                  setPaymentMethod("MOCK");
                  discardQuote();
                }}
              />{" "}
              Thanh toán thử nghiệm
            </label>
          </section>
          {quote && (
            <CheckoutConfirm quote={quote} pending={pending} onConfirm={() => void placeOrder()} />
          )}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={pending || !selected.length || !addressId}
              onClick={() => void createQuote()}
              className="min-h-11 rounded-lg border px-5 font-semibold disabled:opacity-50"
            >
              {quote ? "Cập nhật báo giá" : "Kiểm tra giá và tồn kho"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
