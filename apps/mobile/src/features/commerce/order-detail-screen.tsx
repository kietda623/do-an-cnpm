import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  ApiClientError,
  type ApiPath,
  type components,
} from "@marketplace/api-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSession } from "../auth/session-provider";
import { formatVnd } from "../catalog/catalog-data";
import { OrderActions } from "./order-actions";
import { orderDetailQueryKey, paymentHistoryQueryKey } from "./order-query-keys";

type Order = components["schemas"]["Order"];
type Payment = components["schemas"]["Payment"];
type SellerOrder = components["schemas"]["SellerOrder"];
type OrderItem = components["schemas"]["OrderItem"];

const orderStatusLabels: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang chuẩn bị",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
const paymentStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Đã thanh toán một phần",
  PAID: "Đã thanh toán",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn tiền",
};
const shipmentStatusLabels: Record<string, string> = {
  WAITING_PICKUP: "Chờ lấy hàng",
  PICKED_UP: "Đã lấy hàng",
  IN_TRANSIT: "Đang giao",
  DELIVERED: "Đã giao",
  FAILED: "Giao hàng thất bại",
};

function stringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#a8a29e",
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ color: "#292524", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10, borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 12, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>{title}</Text>
      {children}
    </View>
  );
}

function TrackingTimeline({ sellerOrder }: { sellerOrder: SellerOrder }) {
  const shipment = sellerOrder.shipment;
  if (!shipment) return <Text>Theo dõi vận chuyển sẽ xuất hiện khi shop bàn giao hàng.</Text>;

  return (
    <View style={{ gap: 8 }}>
      <Text>Mã vận đơn: {shipment.trackingCode}</Text>
      <Text>Trạng thái: {shipmentStatusLabels[shipment.status] ?? shipment.status}</Text>
      {shipment.history.map((event, index) => {
        const status = stringField(event, "toStatus") ?? stringField(event, "event") ?? "Cập nhật";
        const createdAt = stringField(event, "createdAt");
        const reason = stringField(event, "reason");
        const id = stringField(event, "id") ?? `${status}-${index}`;
        return (
          <View key={id} style={{ borderLeftWidth: 2, borderColor: "#a8a29e", paddingLeft: 10 }}>
            <Text>{shipmentStatusLabels[status] ?? status}</Text>
            {createdAt ? <Text>{new Date(createdAt).toLocaleString("vi-VN")}</Text> : null}
            {reason ? <Text>{reason}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const attributes = Object.values(item.attributes).join(" / ") || item.sku;
  return (
    <View style={{ gap: 4, borderTopWidth: 1, borderColor: "#e7e5e4", paddingTop: 10 }}>
      <Text style={{ fontWeight: "600" }}>
        {item.productName} × {item.quantity} · {formatVnd(item.unitPrice)}
      </Text>
      <Text style={{ color: "#57534e" }}>{attributes}</Text>
      <Text>Thành tiền: {formatVnd(item.lineTotal)}</Text>
      {item.review ? (
        <Text>Đánh giá hiện có: {item.review.rating}/5 · {item.review.comment}</Text>
      ) : null}
    </View>
  );
}

function PaymentHistory({ payments, order }: { payments: Payment[]; order: Order }) {
  if (!payments.length) return <Text>Chưa có giao dịch thanh toán.</Text>;
  return (
    <View style={{ gap: 12 }}>
      {payments.map((payment) => (
        <View key={payment.id} style={{ gap: 5, borderTopWidth: 1, borderColor: "#e7e5e4", paddingTop: 10 }}>
          <Text style={{ fontWeight: "600" }}>
            {payment.transactionCode} · {paymentStatusLabels[payment.status] ?? payment.status} · {formatVnd(payment.amount)}
          </Text>
          {payment.settlementKind === "LATE_COMPENSATION" ? (
            <Text>Bù trừ thanh toán muộn</Text>
          ) : null}
          {payment.originalAttemptId ? <Text>Giao dịch gốc: {payment.originalAttemptId}</Text> : null}
          {payment.allocations.map((allocation) => {
            const shop = order.sellerOrders.find((part) => part.id === allocation.sellerOrderId);
            return (
              <Text key={allocation.sellerOrderId}>
                Phân bổ {shop?.shopNameSnapshot ?? allocation.sellerOrderId}: {formatVnd(allocation.amount)}
              </Text>
            );
          })}
          {payment.refunds.map((refund, index) => {
            const amount = stringField(refund, "amount");
            const reason = stringField(refund, "reason");
            const sellerOrderId = stringField(refund, "sellerOrderId");
            const shopName = order.sellerOrders.find((part) => part.id === sellerOrderId)?.shopNameSnapshot;
            const refundId = stringField(refund, "id") ?? `${payment.id}-refund-${index}`;
            return (
              <Text key={refundId}>
                Hoàn {amount ? formatVnd(amount) : "tiền"}
                {shopName ? ` cho ${shopName}` : ""}
                {reason ? ` (${reason})` : ""}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { api, user } = useSession();
  const userId = user?.id;
  const detailKey = userId
    ? orderDetailQueryKey(userId, orderId)
    : (["order-detail", "signed-out", orderId] as const);
  const paymentKey = userId
    ? paymentHistoryQueryKey(userId, orderId)
    : (["payment-history", "signed-out", orderId] as const);
  const orderQuery = useQuery<Order>({
    queryKey: detailKey,
    enabled: Boolean(userId && orderId),
    queryFn: ({ signal }) =>
      api.request<Order>(`/orders/${encodeURIComponent(orderId)}` as ApiPath, { signal }),
  });
  const paymentQuery = useQuery<Payment[]>({
    queryKey: paymentKey,
    enabled: Boolean(userId && orderId),
    queryFn: ({ signal }) =>
      api.request<Payment[]>(`/payments?orderId=${encodeURIComponent(orderId)}` as ApiPath, { signal }),
  });

  if (!userId) {
    return (
      <View style={{ flex: 1, gap: 12, padding: 20 }}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Chi tiết đơn hàng
        </Text>
        <Text>Vui lòng đăng nhập để xem đơn hàng.</Text>
      </View>
    );
  }

  if (orderQuery.isPending || paymentQuery.isPending) {
    return (
      <View style={{ flex: 1, gap: 12, padding: 20 }}>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          Chi tiết đơn hàng
        </Text>
        <Text accessibilityRole="progressbar">Đang tải đơn hàng…</Text>
      </View>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    const forbidden = orderQuery.error instanceof ApiClientError && orderQuery.error.status === 403;
    const notFound = orderQuery.error instanceof ApiClientError && orderQuery.error.status === 404;
    return (
      <View style={{ flex: 1, gap: 12, padding: 20 }}>
        <Text accessibilityRole="alert">
          {forbidden
            ? "Bạn không có quyền xem đơn hàng này."
            : notFound
              ? "Không tìm thấy đơn hàng."
              : "Không thể tải đơn hàng."}
        </Text>
        <ActionButton label="Danh sách đơn hàng" onPress={() => router.push("/orders")} />
      </View>
    );
  }

  if (paymentQuery.isError || !paymentQuery.data) {
    return (
      <View style={{ flex: 1, gap: 12, padding: 20 }}>
        <Text accessibilityRole="alert">Không thể tải lịch sử thanh toán.</Text>
        <ActionButton
          label="Thử tải lại"
          onPress={() => {
            void Promise.all([orderQuery.refetch(), paymentQuery.refetch()]);
          }}
        />
      </View>
    );
  }

  const order = orderQuery.data;
  const payments = paymentQuery.data;
  const address = order.sellerOrders[0]?.addressSnapshot;
  const codLabel =
    order.paymentMethod === "COD"
      ? order.capturedAmount === "0"
        ? "COD chưa thu"
        : "COD đã thu"
      : null;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, gap: 16, padding: 20 }}>
      <View style={{ gap: 8 }}>
        <ActionButton label="Đơn hàng của tôi" onPress={() => router.push("/orders")} />
        <Text style={{ color: "#57534e" }}>Chi tiết đơn hàng</Text>
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>
          {order.orderNumber}
        </Text>
        <Text>
          {orderStatusLabels[order.status] ?? order.status} · {new Date(order.createdAt).toLocaleString("vi-VN")}
        </Text>
      </View>

      {address ? (
        <Section title="Địa chỉ giao hàng">
          <Text>{address.recipientName} · {address.phone}</Text>
          <Text>
            {address.line1}, {address.ward}, {address.district}, {address.province}
          </Text>
        </Section>
      ) : null}

      {order.sellerOrders.map((sellerOrder) => (
        <Section key={sellerOrder.id} title={sellerOrder.shopNameSnapshot}>
          <Text>Trạng thái: {orderStatusLabels[sellerOrder.status] ?? sellerOrder.status}</Text>
          {sellerOrder.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}
          <TrackingTimeline sellerOrder={sellerOrder} />
          <Text>Tổng shop: {formatVnd(sellerOrder.originalTotal)}</Text>
          <Text>
            Đã thu {formatVnd(sellerOrder.capturedAmount)} · Đã hoàn {formatVnd(sellerOrder.refundedAmount)}
          </Text>
          <Text>Còn phải trả: {formatVnd(sellerOrder.outstandingAmount)}</Text>
          {sellerOrder.cancelReason ? <Text>Lý do hủy: {sellerOrder.cancelReason}</Text> : null}
        </Section>
      ))}

      <Section title="Thanh toán">
        <Text>
          {order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng" : "Thanh toán mô phỏng"} · {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
        </Text>
        {codLabel ? <Text>{codLabel}</Text> : null}
        <Text>Đã thu: {formatVnd(order.capturedAmount)} · Đã hoàn: {formatVnd(order.refundedAmount)}</Text>
        <Text>Còn phải trả: {formatVnd(order.outstandingAmount)}</Text>
        {order.paymentDeadline ? (
          <Text>Hạn thanh toán: {new Date(order.paymentDeadline).toLocaleString("vi-VN")} (theo thời hạn máy chủ)</Text>
        ) : null}
        <PaymentHistory payments={payments} order={order} />
      </Section>

      <Section title="Tổng đơn hàng">
        <Text>Tổng ban đầu: {formatVnd(order.originalTotal)}</Text>
        <Text>Đã hủy: {formatVnd(order.cancelledAmount)}</Text>
        <Text>Đã thu: {formatVnd(order.capturedAmount)}</Text>
        <Text>Đã hoàn: {formatVnd(order.refundedAmount)}</Text>
        <Text>Còn phải trả: {formatVnd(order.outstandingAmount)}</Text>
      </Section>

      <OrderActions order={order} payments={payments} />
    </ScrollView>
  );
}
