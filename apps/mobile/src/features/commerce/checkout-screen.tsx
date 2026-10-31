import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  type components,
} from "@marketplace/api-client";
import { useRouter } from "expo-router";
import { useSession } from "../auth/session-provider";
import { formatVnd } from "../catalog/catalog-data";
import { cartQueryKey } from "./cart-screen";
import { writeIntentRegistry } from "./write-intents";

type Address = components["schemas"]["Address"];
type Cart = components["schemas"]["Cart"];
type CartItem = components["schemas"]["CartItem"];
type CheckoutQuote = components["schemas"]["CheckoutQuote"];
type CheckoutQuoteRequest = components["schemas"]["CheckoutQuoteRequest"];
type CheckoutCreate = components["schemas"]["CheckoutCreate"];
type Order = components["schemas"]["Order"];
type PaymentMethod = CheckoutQuoteRequest["paymentMethod"];

const style = {
  page: { flexGrow: 1, gap: 16, padding: 20 },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 12,
    padding: 16,
  },
  button: {
    minHeight: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 8,
    backgroundColor: "#176b57",
    paddingHorizontal: 16,
  },
};
const MAX_TIMER_DELAY_MS = 2_147_483_647;

function ActionButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        style.button,
        disabled ? { backgroundColor: "#e7e5e4" } : undefined,
      ]}
    >
      <Text style={{ color: disabled ? "#57534e" : "white", fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiClientError)) return undefined;
  const payload = error.payload as
    | { error?: { code?: string } }
    | undefined;
  return payload?.error?.code;
}

function RadioOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <Text>{selected ? "🔘" : "◯"}</Text>
      <Text>{label}</Text>
    </Pressable>
  );
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiClientError && error.status === 403)
    return "Bạn không có quyền thực hiện thao tác này.";
  return fallback;
}

export function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api, user } = useSession();
  const userId = user?.id;
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteInputFingerprint, setQuoteInputFingerprint] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const cartQuery = useQuery<Cart>({
    queryKey: userId ? cartQueryKey(userId) : (["cart", "signed-out"] as const),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => api.request<Cart>("/cart", { signal }),
  });
  const addressQuery = useQuery<Address[]>({
    queryKey: userId ? ["addresses", userId] : (["addresses", "signed-out"] as const),
    enabled: Boolean(userId),
    queryFn: ({ signal }) =>
      api.request<Address[]>("/users/me/addresses", { signal }),
  });

  const selectedAddress = useMemo(() => {
    const addresses = addressQuery.data ?? [];
    return (
      addresses.find((address) => address.id === selectedAddressId) ??
      addresses.find((address) => address.isDefault) ??
      addresses[0]
    );
  }, [addressQuery.data, selectedAddressId]);
  const selectedItems = useMemo(
    () =>
      (cartQuery.data?.groups ?? []).flatMap((group) =>
        group.items.filter((item) => item.selected),
      ),
    [cartQuery.data],
  );
  const selectedItemIds = useMemo(
    () => [...new Set(selectedItems.map((item) => item.id))],
    [selectedItems],
  );
  const inputFingerprint = JSON.stringify({
    userId,
    items: selectedItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      currentUnitPrice: item.currentUnitPrice,
      availableQuantity: item.availableQuantity,
      purchasable: item.purchasable,
    })),
    address: selectedAddress
      ? {
          id: selectedAddress.id,
          recipientName: selectedAddress.recipientName,
          phone: selectedAddress.phone,
          line1: selectedAddress.line1,
          ward: selectedAddress.ward,
          district: selectedAddress.district,
          province: selectedAddress.province,
          country: selectedAddress.country,
        }
      : null,
    paymentMethod,
  });

  const quoteMutation = useMutation<CheckoutQuote, Error, CheckoutQuoteRequest>({
    mutationFn: (request) =>
      api.request<CheckoutQuote>("/checkout/quotes", {
        method: "POST",
        body: JSON.stringify(request),
      }),
  });

  const checkoutMutation = useMutation<Order, Error, CheckoutQuote>({
    mutationFn: async (currentQuote) => {
      if (!userId) throw new Error("Buyer session is missing");
      const body: CheckoutCreate = { quoteId: currentQuote.quoteId };
      const scope = `${userId}:POST:/checkout:${currentQuote.quoteId}`;
      const intent = writeIntentRegistry.getOrCreate(scope, body);
      return api.request<Order>("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (order, currentQuote) => {
      if (userId) {
        const body: CheckoutCreate = { quoteId: currentQuote.quoteId };
        const scope = `${userId}:POST:/checkout:${currentQuote.quoteId}`;
        writeIntentRegistry.complete(scope, body);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cartQueryKey(userId) }),
          queryClient.invalidateQueries({ queryKey: ["orders", userId] }),
        ]);
      }
      router.push(`/orders/${order.id}`);
    },
  });

  useEffect(() => {
    if (!quote || quoteInputFingerprint !== inputFingerprint) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const checkExpiry = () => {
      const remaining = Date.parse(quote.expiresAt) - Date.now();
      if (remaining <= 0) {
        setNow(Date.now());
        return;
      }
      timeout = setTimeout(checkExpiry, Math.min(remaining, MAX_TIMER_DELAY_MS));
    };
    checkExpiry();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [inputFingerprint, quote?.expiresAt, quoteInputFingerprint]);

  useEffect(() => {
    if (quote && quoteInputFingerprint !== inputFingerprint) {
      setQuote(null);
      setQuoteInputFingerprint(null);
    }
  }, [inputFingerprint, quote, quoteInputFingerprint]);

  const isLoading = cartQuery.isPending || addressQuery.isPending;
  const readError = cartQuery.error ?? addressQuery.error;
  const activeQuote =
    quote && quoteInputFingerprint === inputFingerprint ? quote : null;
  const quoteExpired = Boolean(
    activeQuote && Date.parse(activeQuote.expiresAt) <= now,
  );
  const quoteUsable = Boolean(activeQuote?.valid && !quoteExpired);
  const priceChanged =
    checkoutMutation.error instanceof ApiClientError &&
    checkoutMutation.error.status === 409 &&
    apiErrorCode(checkoutMutation.error) === "PRICE_CHANGED";
  const quoteError = quoteMutation.error;
  const selectedItemNames = new Map(
    selectedItems.map((item) => [item.id, item.productName]),
  );
  const isBusy = quoteMutation.isPending || checkoutMutation.isPending;

  function clearQuote() {
    setQuote(null);
    setQuoteInputFingerprint(null);
    quoteMutation.reset();
    checkoutMutation.reset();
  }

  async function createQuote() {
    if (!selectedAddress || selectedItemIds.length === 0) return;
    const requestFingerprint = inputFingerprint;
    checkoutMutation.reset();
    setQuote(null);
    setQuoteInputFingerprint(null);
    try {
      const nextQuote = await quoteMutation.mutateAsync({
        cartItemIds: selectedItemIds,
        addressId: selectedAddress.id,
        paymentMethod,
      });
      setQuote(nextQuote);
      setQuoteInputFingerprint(requestFingerprint);
      setNow(Date.now());
    } catch {
      // React Query keeps the error for the retry action below.
    }
  }

  function retryQuote() {
    void createQuote();
  }

  function placeOrder() {
    if (quoteUsable && activeQuote) checkoutMutation.mutate(activeQuote);
  }

  if (!userId) {
    return (
      <View style={style.page}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Thanh toán
        </Text>
        <Text>Vui lòng đăng nhập để tiếp tục thanh toán.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={style.page}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Thanh toán
        </Text>
        <Text accessibilityRole="progressbar">Đang tải thông tin thanh toán…</Text>
      </View>
    );
  }

  if (readError || !cartQuery.data || !addressQuery.data) {
    return (
      <View style={style.page}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Thanh toán
        </Text>
        <Text accessibilityRole="alert">
          {errorText(readError, "Không thể tải thông tin thanh toán.")}
        </Text>
        <ActionButton
          label="Thử lại"
          onPress={() => {
            void cartQuery.refetch();
            void addressQuery.refetch();
          }}
        />
      </View>
    );
  }

  const cart = cartQuery.data;
  const hasAddress = addressQuery.data.length > 0;
  const quoteErrorMessage = quoteError
    ? errorText(quoteError, "Không thể tạo báo giá. Vui lòng thử lại.")
    : null;
  const checkoutErrorMessage = checkoutMutation.error
    ? priceChanged
      ? "Giá hoặc tồn kho đã thay đổi. Hãy tạo và xem lại báo giá mới."
      : errorText(
          checkoutMutation.error,
          "Không thể xác nhận đơn hàng. Vui lòng thử lại.",
        )
    : null;

  return (
    <ScrollView contentContainerStyle={style.page}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: "#57534e" }}>Giỏ hàng</Text>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Thanh toán
        </Text>
        <ActionButton
          label="Quay lại giỏ hàng"
          onPress={() => router.push("/cart")}
        />
      </View>

      <View style={style.card}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Địa chỉ nhận hàng
        </Text>
        {hasAddress ? (
          addressQuery.data.map((address) => (
            <RadioOption
              key={address.id}
              label={`Địa chỉ của ${address.recipientName}${address.isDefault ? " (Mặc định)" : ""}`}
              selected={selectedAddress?.id === address.id}
              disabled={isBusy}
              onPress={() => {
                setSelectedAddressId(address.id);
                clearQuote();
              }}
            />
          ))
        ) : (
          <>
            <Text>Chưa có địa chỉ nhận hàng.</Text>
            <ActionButton
              label="Thêm địa chỉ"
              onPress={() => router.push("/account/addresses")}
            />
          </>
        )}
      </View>

      <View style={style.card}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Sản phẩm đã chọn</Text>
        {cart.groups.map((group) => {
          const items = group.items.filter((item) => item.selected);
          if (!items.length) return null;
          return (
            <View key={group.shopId} style={{ gap: 8 }}>
              <Text style={{ fontWeight: "600" }}>{group.shopName}</Text>
              {items.map((item) => (
                <SelectedCartLine key={item.id} item={item} />
              ))}
            </View>
          );
        })}
        {selectedItems.length === 0 ? (
          <Text>Chưa có sản phẩm được chọn.</Text>
        ) : null}
      </View>

      <View style={style.card}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Phương thức thanh toán
        </Text>
        <RadioOption
          label="Thanh toán khi nhận hàng"
          selected={paymentMethod === "COD"}
          disabled={isBusy}
          onPress={() => {
            setPaymentMethod("COD");
            clearQuote();
          }}
        />
        <RadioOption
          label="Thanh toán thử nghiệm"
          selected={paymentMethod === "MOCK"}
          disabled={isBusy}
          onPress={() => {
            setPaymentMethod("MOCK");
            clearQuote();
          }}
        />
      </View>

          {quoteErrorMessage ? (
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="alert">{quoteErrorMessage}</Text>
              <ActionButton label="Thử tạo báo giá lại" onPress={retryQuote} />
            </View>
          ) : null}
          {checkoutErrorMessage ? (
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="alert">{checkoutErrorMessage}</Text>
              {priceChanged ? (
                <ActionButton
                  label="Tạo báo giá mới"
                  onPress={() => void createQuote()}
                />
              ) : (
                <ActionButton
                  label="Thử đặt hàng lại"
                  onPress={placeOrder}
                />
              )}
            </View>
          ) : null}

          {activeQuote ? (
            <View style={style.card}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>
                Xác nhận đơn hàng
              </Text>
              <Text>
                Báo giá có hiệu lực đến {new Date(activeQuote.expiresAt).toLocaleString("vi-VN")}
              </Text>
              {quoteExpired ? (
                <Text accessibilityRole="alert">Báo giá đã hết hạn.</Text>
              ) : null}
              {activeQuote.lines.map((line) => (
                <Text key={line.cartItemId}>
                  {selectedItemNames.get(line.cartItemId) ?? "Sản phẩm"} × {line.quantity}: {formatVnd(line.lineTotal)}
                </Text>
              ))}
              {activeQuote.groups.map((group) => (
                <View key={group.shopId} style={{ gap: 4 }}>
                  <Text>
                    {cart.groups.find((cartGroup) => cartGroup.shopId === group.shopId)?.shopName ?? "Cửa hàng"}
                  </Text>
                  <Text>Tạm tính: {formatVnd(group.subtotal)}</Text>
                  <Text>Phí giao hàng: {formatVnd(group.shippingFee)}</Text>
                  <Text>Thành tiền: {formatVnd(group.total)}</Text>
                </View>
              ))}
              {activeQuote.issues.map((issue, index) => (
                <Text key={`${issue.cartItemId ?? "general"}-${issue.code}-${index}`} accessibilityRole="alert">
                  {issue.cartItemId ? `${selectedItemNames.get(issue.cartItemId) ?? "Sản phẩm"}: ` : ""}
                  {issue.message}
                </Text>
              ))}
              <Text style={{ fontSize: 18, fontWeight: "700" }}>
                Tổng cộng: {formatVnd(activeQuote.total)}
              </Text>
              <ActionButton
                label="Đặt hàng"
                disabled={!quoteUsable || isBusy || checkoutMutation.isError}
                onPress={placeOrder}
              />
            </View>
          ) : null}

          <ActionButton
            label="Tạo báo giá"
            disabled={!selectedAddress || selectedItemIds.length === 0 || isBusy}
            onPress={() => void createQuote()}
          />
      
    </ScrollView>
  );
}

function SelectedCartLine({ item }: { item: CartItem }) {
  return (
    <Text>
      {item.productName} × {item.quantity} · {formatVnd(item.currentUnitPrice)}
      {!item.purchasable ? " · cần kiểm tra tồn kho" : ""}
    </Text>
  );
}
