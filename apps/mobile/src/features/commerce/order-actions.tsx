import React, { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  ApiClientError,
  type ApiPath,
  type components,
} from "@marketplace/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../auth/session-provider";
import { writeIntentRegistry } from "./write-intents";
import {
  orderDetailQueryKey,
  orderListQueryPrefix,
  paymentHistoryQueryKey,
} from "./order-query-keys";

type Order = components["schemas"]["Order"];
type Payment = components["schemas"]["Payment"];
type SellerOrder = components["schemas"]["SellerOrder"];
type MockOutcome = components["schemas"]["MockResult"]["outcome"];
type CancelTarget = "ALL" | { sellerOrderId: string; shopNameSnapshot: string };

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
      style={{
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: disabled ? "#e7e5e4" : "#176b57",
        paddingHorizontal: 14,
      }}
    >
      <Text
        style={{ color: disabled ? "#57534e" : "white", fontWeight: "600" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function errorPayload(error: unknown): Record<string, unknown> | undefined {
  if (
    !(error instanceof ApiClientError) ||
    !error.payload ||
    typeof error.payload !== "object"
  )
    return undefined;
  const payload = error.payload as Record<string, unknown>;
  const envelope = payload.error;
  return envelope && typeof envelope === "object"
    ? (envelope as Record<string, unknown>)
    : undefined;
}

function blockingShopNames(error: unknown, order: Order): string[] {
  const envelope = errorPayload(error);
  if (!Array.isArray(envelope?.details)) return [];
  return envelope.details.flatMap((detail) => {
    if (!detail || typeof detail !== "object") return [];
    const value = detail as Record<string, unknown>;
    if (
      value.field !== "blockingSellerOrderIds" ||
      typeof value.message !== "string"
    )
      return [];
    const shop = order.sellerOrders.find((part) => part.id === value.message);
    return [shop?.shopNameSnapshot ?? value.message];
  });
}

function mutationErrorText(error: unknown, fallback: string) {
  if (error instanceof ApiClientError && error.status === 409)
    return "Trạng thái đơn đã thay đổi. Đã tải lại dữ liệu mới nhất.";
  return fallback;
}

function latestMockAttempt(
  payments: Payment[],
  order: Order,
): Payment | undefined {
  // The API returns attempts in attemptNumber order. createdAt can tie, so it
  // cannot identify the newest attempt. The no-attempt base payment is a
  // synthetic row whose transactionCode is the order number.
  return payments
    .filter((payment) => payment.transactionCode !== order.orderNumber)
    .at(-1);
}

export function OrderActions({
  order,
  payments,
}: {
  order: Order;
  payments: Payment[];
}) {
  const queryClient = useQueryClient();
  const { api, user } = useSession();
  const userId = user?.id;
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const orderKey = userId ? orderDetailQueryKey(userId, order.id) : [];
  const paymentsKey = userId ? paymentHistoryQueryKey(userId, order.id) : [];
  const refreshOrder = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKey }),
      queryClient.invalidateQueries({ queryKey: paymentsKey }),
      queryClient.invalidateQueries({
        queryKey: orderListQueryPrefix(userId),
      }),
    ]);
  }, [orderKey, paymentsKey, queryClient, userId]);
  const refreshOnConflict = useCallback(
    async (error: Error) => {
      if (error instanceof ApiClientError && error.status === 409)
        await refreshOrder();
    },
    [refreshOrder],
  );

  const attemptMutation = useMutation<Payment, Error, void>({
    mutationFn: async () => {
      if (!userId) throw new Error("Buyer session is missing");
      const body = { orderId: order.id };
      const scope = `${userId}:POST:/payments/mock-attempts`;
      const intent = writeIntentRegistry.getOrCreate(scope, body);
      const attempt = await api.request<Payment>("/payments/mock-attempts", {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(body),
      });
      writeIntentRegistry.complete(scope, body);
      return attempt;
    },
    onSuccess: refreshOrder,
    onError: refreshOnConflict,
  });

  const resultMutation = useMutation<
    Payment,
    Error,
    {
      attemptId: string;
      outcome: MockOutcome;
      expectedVersion: number;
    }
  >({
    mutationFn: async ({ attemptId, outcome, expectedVersion }) => {
      if (!userId) throw new Error("Buyer session is missing");
      const route = `/payments/${attemptId}/mock-result` as ApiPath;
      const request = { outcome, expectedVersion };
      const scope = `${userId}:POST:${route}`;
      const intent = writeIntentRegistry.getOrCreate(scope, request);
      const body = { eventId: intent.eventId, ...request };
      const result = await api.request<Payment>(route, {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(body),
      });
      writeIntentRegistry.complete(scope, request);
      return result;
    },
    onSuccess: refreshOrder,
    onError: refreshOnConflict,
  });

  const cancelMutation = useMutation<
    unknown,
    Error,
    {
      target: CancelTarget;
      reason: string;
      expectedVersion: number;
    }
  >({
    mutationFn: async ({ target, reason, expectedVersion }) => {
      if (!userId) throw new Error("Buyer session is missing");
      const route =
        target === "ALL"
          ? `/orders/${order.id}/cancel`
          : `/orders/${order.id}/seller-orders/${target.sellerOrderId}/cancel`;
      const body = { reason: reason.trim(), expectedVersion };
      const scope = `${userId}:POST:${route}`;
      const intent = writeIntentRegistry.getOrCreate(scope, body);
      const result = await api.request<unknown>(route as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(body),
      });
      writeIntentRegistry.complete(scope, body);
      return result;
    },
    onSuccess: async () => {
      setCancelTarget(null);
      setCancelReason("");
      await refreshOrder();
    },
    onError: refreshOnConflict,
  });

  const receiveMutation = useMutation<
    SellerOrder,
    Error,
    {
      sellerOrderId: string;
      expectedVersion: number;
    }
  >({
    mutationFn: async ({ sellerOrderId, expectedVersion }) => {
      if (!userId) throw new Error("Buyer session is missing");
      const route =
        `/orders/${order.id}/seller-orders/${sellerOrderId}/receive` as ApiPath;
      const body = { expectedVersion };
      const scope = `${userId}:POST:${route}`;
      const intent = writeIntentRegistry.getOrCreate(scope, body);
      const result = await api.request<SellerOrder>(route, {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(body),
      });
      writeIntentRegistry.complete(scope, body);
      return result;
    },
    onSuccess: refreshOrder,
    onError: refreshOnConflict,
  });

  const pendingMockAttempt = latestMockAttempt(payments, order);
  const attemptConflict =
    attemptMutation.error instanceof ApiClientError &&
    attemptMutation.error.status === 409;
  const canStartMockAttempt =
    order.paymentMethod === "MOCK" &&
    order.status !== "CANCELLED" &&
    order.outstandingAmount !== "0" &&
    pendingMockAttempt?.status !== "PENDING" &&
    !attemptConflict;
  const liveSellerOrders = order.sellerOrders.filter(
    (part) => part.status !== "CANCELLED",
  );
  const canCancelOrder =
    order.status !== "CANCELLED" && liveSellerOrders.length > 0;
  const canCancelAll =
    canCancelOrder &&
    liveSellerOrders.every((part) => part.status === "PENDING");
  const writePending =
    attemptMutation.isPending ||
    resultMutation.isPending ||
    cancelMutation.isPending ||
    receiveMutation.isPending;
  const selectedCancelLabel =
    cancelTarget === "ALL"
      ? "toàn bộ đơn"
      : (cancelTarget?.shopNameSnapshot ?? "đơn hàng");
  const cancellationBlockers = blockingShopNames(cancelMutation.error, order);
  const cancellationError = cancelMutation.error
    ? `${mutationErrorText(cancelMutation.error, "Không thể hủy đơn. Vui lòng thử lại.")}${cancellationBlockers.length ? ` Cửa hàng đang xử lý: ${cancellationBlockers.join(", ")}.` : ""}`
    : null;

  function cancelSelected() {
    if (!cancelTarget || !cancelReason.trim()) return;
    const part =
      cancelTarget === "ALL"
        ? undefined
        : order.sellerOrders.find(
            (item) => item.id === cancelTarget.sellerOrderId,
          );
    if (cancelTarget !== "ALL" && !part) return;
    cancelMutation.mutate({
      target: cancelTarget,
      reason: cancelReason.trim(),
      expectedVersion: cancelTarget === "ALL" ? order.version : part!.version,
    });
  }

  function submitMockResult(attemptId: string, outcome: MockOutcome) {
    resultMutation.mutate({
      attemptId,
      outcome,
      expectedVersion: order.version,
    });
  }

  function submitReceive(part: SellerOrder) {
    receiveMutation.mutate({
      sellerOrderId: part.id,
      expectedVersion: part.version,
    });
  }

  return (
    <View style={{ gap: 16 }}>
      {order.paymentMethod === "MOCK" && canStartMockAttempt ? (
        <View style={{ gap: 8 }}>
          <ActionButton
            label="Tạo lần thử thanh toán"
            disabled={writePending}
            onPress={() => attemptMutation.mutate()}
          />
        </View>
      ) : null}
      {order.paymentMethod === "MOCK" &&
      pendingMockAttempt?.status === "PENDING" ? (
        <View style={{ gap: 8 }}>
          <ActionButton
            label="Mô phỏng thanh toán thành công"
            disabled={writePending}
            onPress={() => submitMockResult(pendingMockAttempt.id, "SUCCEEDED")}
          />
          <ActionButton
            label="Mô phỏng thất bại"
            disabled={writePending}
            onPress={() => submitMockResult(pendingMockAttempt.id, "FAILED")}
          />
          <ActionButton
            label="Hủy lần thử thanh toán"
            disabled={writePending}
            onPress={() => submitMockResult(pendingMockAttempt.id, "CANCELLED")}
          />
        </View>
      ) : null}
      {attemptMutation.error ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert">
            {mutationErrorText(
              attemptMutation.error,
              "Không thể bắt đầu thanh toán. Vui lòng thử lại.",
            )}
          </Text>
          {!attemptConflict ? (
            <ActionButton
              label="Thử tạo lần thanh toán lại"
              disabled={writePending}
              onPress={() => attemptMutation.mutate()}
            />
          ) : null}
        </View>
      ) : null}
      {resultMutation.error ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert">
            {mutationErrorText(
              resultMutation.error,
              "Không thể cập nhật thanh toán. Vui lòng thử lại.",
            )}
          </Text>
          {resultMutation.error instanceof ApiClientError &&
          resultMutation.error.status ===
            409 ? null : resultMutation.variables ? (
            <ActionButton
              label="Thử lại kết quả thanh toán"
              disabled={writePending}
              onPress={() => resultMutation.mutate(resultMutation.variables!)}
            />
          ) : null}
        </View>
      ) : null}

      {canCancelOrder ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "600" }}>Hủy đơn</Text>
          {canCancelAll ? (
            <ActionButton
              label="Hủy toàn đơn"
              disabled={writePending}
              onPress={() => {
                cancelMutation.reset();
                setCancelReason("");
                setCancelTarget("ALL");
              }}
            />
          ) : null}
          {order.sellerOrders
            .filter((part) => part.status === "PENDING")
            .map((part) => (
              <ActionButton
                key={part.id}
                label={`Hủy riêng ${part.shopNameSnapshot}`}
                disabled={writePending}
                onPress={() => {
                  cancelMutation.reset();
                  setCancelReason("");
                  setCancelTarget({
                    sellerOrderId: part.id,
                    shopNameSnapshot: part.shopNameSnapshot,
                  });
                }}
              />
            ))}
        </View>
      ) : null}
      {cancelTarget ? (
        <View
          accessibilityRole="summary"
          style={{
            gap: 8,
            borderWidth: 1,
            borderColor: "#d6d3d1",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text style={{ fontWeight: "600" }}>
            Xác nhận hủy {selectedCancelLabel}
          </Text>
          <Text>
            Hệ thống kiểm tra trạng thái mới nhất và cập nhật hoàn kho, hoàn
            tiền.
          </Text>
          <TextInput
            accessibilityLabel="Lý do hủy"
            placeholder="Lý do hủy"
            value={cancelReason}
            onChangeText={setCancelReason}
            maxLength={500}
            multiline
            style={{
              minHeight: 72,
              borderWidth: 1,
              borderColor: "#d6d3d1",
              borderRadius: 8,
              padding: 12,
            }}
          />
          {cancellationError ? (
            <Text accessibilityRole="alert">{cancellationError}</Text>
          ) : null}
          <ActionButton
            label={cancelMutation.isPending ? "Đang hủy…" : "Xác nhận hủy"}
            disabled={writePending || !cancelReason.trim()}
            onPress={cancelSelected}
          />
          {cancelMutation.error &&
          !(
            cancelMutation.error instanceof ApiClientError &&
            cancelMutation.error.status === 409
          ) ? (
            <ActionButton
              label="Thử hủy lại"
              disabled={writePending || !cancelReason.trim()}
              onPress={cancelSelected}
            />
          ) : null}
          <ActionButton
            label="Đóng"
            disabled={writePending}
            onPress={() => setCancelTarget(null)}
          />
        </View>
      ) : null}

      {order.sellerOrders
        .filter(
          (part) =>
            part.status === "DELIVERED" && part.outstandingAmount === "0",
        )
        .map((part) => (
          <View key={part.id} style={{ gap: 8 }}>
            <ActionButton
              label="Tôi đã nhận đủ hàng"
              disabled={writePending}
              onPress={() => submitReceive(part)}
            />
            {receiveMutation.error &&
            receiveMutation.variables?.sellerOrderId === part.id ? (
              <>
                <Text accessibilityRole="alert">
                  {mutationErrorText(
                    receiveMutation.error,
                    "Không thể xác nhận đã nhận hàng. Vui lòng thử lại.",
                  )}
                </Text>
                {receiveMutation.error instanceof ApiClientError &&
                receiveMutation.error.status === 409 ? null : (
                  <ActionButton
                    label="Thử xác nhận đã nhận lại"
                    disabled={writePending}
                    onPress={() =>
                      receiveMutation.mutate(receiveMutation.variables!)
                    }
                  />
                )}
              </>
            ) : null}
          </View>
        ))}
    </View>
  );
}
