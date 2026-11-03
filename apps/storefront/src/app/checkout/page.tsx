"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  EmptyState,
  MapPin,
  PageHeader,
  SelectField,
  StatusMessage,
  formatVnd,
  useApi,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError } from "@marketplace/api-client";
import { webSession } from "../../lib/session";
import { CheckoutConfirm } from "../../features/checkout/checkout-confirm";

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
  const { user, status, clear } = useApi();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [addressId, setAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "MOCK">("COD");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState("");
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login?returnTo=%2Fcheckout");
      return;
    }
    let active = true;
    setLoading(true);
    setBootstrapError("");
    void (async () => {
      try {
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
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiClientError && cause.status === 401) {
          await clear();
          router.replace("/login?returnTo=%2Fcheckout");
          return;
        }
        setBootstrapError("Không thể tải thông tin thanh toán. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clear, reload, router, status]);

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
        queryClient.invalidateQueries({ queryKey: ["cart", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["orders", user?.id] }),
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
      <div className="mp-container mp-checkout" aria-busy="true">
        <PageHeader title="Thanh toán" />
        <span className="mp-skeleton mp-checkout__skeleton" />
        <p className="mp-visually-hidden" role="status">
          Đang tải thông tin thanh toán…
        </p>
      </div>
    );

  if (bootstrapError)
    return (
      <div className="mp-container mp-checkout">
        <PageHeader title="Thanh toán" />
        <StatusMessage tone="error" title="Không thể tải thông tin thanh toán">
          {bootstrapError}{" "}
          <button
            type="button"
            className="mp-link"
            onClick={() => {
              setBootstrapError("");
              setLoading(true);
              setReload((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </StatusMessage>
      </div>
    );

  return (
    <div className="mp-container mp-checkout">
      <PageHeader
        title="Thanh toán"
        description="Giá và tồn kho được xác nhận lại khi tạo báo giá. Đơn sẽ được tách theo từng cửa hàng."
        actions={
          <Link className="mp-button mp-button--secondary" href="/cart">
            Quay lại giỏ hàng
          </Link>
        }
      />

      <ol className="mp-steps" aria-label="Các bước thanh toán">
        <li className="mp-step mp-step--done">Giỏ hàng</li>
        <li className="mp-step mp-step--current" aria-current="step">
          Thanh toán
        </li>
        <li className="mp-step">Hoàn tất</li>
      </ol>

      {error && (
        <StatusMessage tone="error" title="Chưa thể tiếp tục" onDismiss={() => setError("")}>
          {error}
        </StatusMessage>
      )}

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} />}
          title="Anh chưa có địa chỉ nhận hàng."
          description="Thêm địa chỉ để hệ thống tính phí và xác nhận giao hàng."
          action={
            <Link className="mp-button mp-button--primary" href="/account/addresses">
              Thêm địa chỉ
            </Link>
          }
        />
      ) : (
        <div className="mp-checkout__layout">
          <div className="mp-checkout__main">
            <section className="mp-checkout__panel" aria-labelledby="checkout-address">
              <header>
                <h2 id="checkout-address">Địa chỉ nhận hàng</h2>
                <Link href="/account/addresses">Quản lý địa chỉ</Link>
              </header>
              <SelectField
                label="Chọn địa chỉ"
                value={addressId}
                onChange={(event) => {
                  setAddressId(event.target.value);
                  discardQuote();
                }}
              >
                <option value="">Chọn địa chỉ</option>
                {addresses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.recipientName} · {item.phone} — {item.line1}, {item.ward}, {item.district},{" "}
                    {item.province}
                    {item.isDefault ? " (Mặc định)" : ""}
                  </option>
                ))}
              </SelectField>
            </section>

            <section className="mp-checkout__panel" aria-labelledby="checkout-items">
              <header>
                <h2 id="checkout-items">Sản phẩm</h2>
                <span>{selected.length} sản phẩm đã chọn</span>
              </header>
              {selected.length === 0 ? (
                <p className="mp-checkout__empty">
                  Chưa chọn sản phẩm.{" "}
                  <Link className="mp-link" href="/cart">
                    Quay lại giỏ hàng
                  </Link>
                </p>
              ) : (
                <ul className="mp-checkout__items">
                  {selected.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.productName} × {item.quantity}
                        {!item.purchasable ? " · cần kiểm tra tồn kho" : ""}
                      </span>
                      <strong data-numeric>
                        {formatVnd(
                          (BigInt(item.currentUnitPrice) * BigInt(item.quantity)).toString(),
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <fieldset className="mp-checkout__panel mp-checkout__payment">
              <legend>Phương thức thanh toán</legend>
              <label className={paymentMethod === "COD" ? "mp-choice mp-choice--active" : "mp-choice"}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "COD"}
                  onChange={() => {
                    setPaymentMethod("COD");
                    discardQuote();
                  }}
                />
                <span>
                  <strong>Thanh toán khi nhận hàng</strong>
                  <small>Trả tiền cho đơn vị giao hàng khi nhận đủ.</small>
                </span>
              </label>
              <label className={paymentMethod === "MOCK" ? "mp-choice mp-choice--active" : "mp-choice"}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "MOCK"}
                  onChange={() => {
                    setPaymentMethod("MOCK");
                    discardQuote();
                  }}
                />
                <span>
                  <strong>Thanh toán thử nghiệm</strong>
                  <small>Mô phỏng kết quả thành công hoặc thất bại.</small>
                </span>
              </label>
            </fieldset>

            {quote && (
              <CheckoutConfirm
                quote={quote}
                pending={pending}
                onConfirm={() => void placeOrder()}
              />
            )}

            <div className="mp-checkout__actions">
              <Button
                variant={quote ? "secondary" : "primary"}
                size="lg"
                loading={pending}
                disabled={!selected.length || !addressId}
                onClick={() => void createQuote()}
              >
                {quote ? "Cập nhật báo giá" : "Kiểm tra giá và tồn kho"}
              </Button>
            </div>
          </div>

          <aside className="mp-checkout__summary" aria-label="Tóm tắt thanh toán">
            <h2>Đơn hàng của anh</h2>
            <dl>
              <div>
                <dt>Tạm tính</dt>
                <dd data-numeric>{formatVnd(cart?.selectedTotal)}</dd>
              </div>
              <div>
                <dt>Phí vận chuyển</dt>
                <dd>Theo báo giá</dd>
              </div>
            </dl>
            <p className="mp-checkout__note">
              Báo giá được lưu lại để có thể tiếp tục nếu cần thử lại. Mã đơn chỉ được tạo một
              lần cho mỗi lần xác nhận.
            </p>
            <ul className="mp-cart__assurances">
              <li>Hủy từng cửa hàng khi còn chờ xác nhận</li>
              <li>Theo dõi vận chuyển riêng từng kiện</li>
              <li>Xác nhận nhận hàng sau khi giao đủ</li>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
