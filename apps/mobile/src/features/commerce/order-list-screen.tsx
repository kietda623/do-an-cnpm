import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  ApiClientError,
  type ApiPath,
  type components,
} from "@marketplace/api-client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useSession } from "../auth/session-provider";
import { formatVnd } from "../catalog/catalog-data";

type OrderSummary = components["schemas"]["OrderSummary"];

const PAGE_SIZE = 20;
const statuses = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PACKING", label: "Đang chuẩn bị" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "DELIVERED", label: "Đã giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
] as const;
const paymentStatuses = [
  { value: "", label: "Tất cả" },
  { value: "UNPAID", label: "Chưa thanh toán" },
  { value: "PARTIALLY_PAID", label: "Đã thanh toán một phần" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "PARTIALLY_REFUNDED", label: "Đã hoàn một phần" },
  { value: "REFUNDED", label: "Đã hoàn tiền" },
] as const;

const statusLabels: Record<string, string> = Object.fromEntries(
  statuses
    .filter((option) => option.value)
    .map((option) => [option.value, option.label]),
);
const paymentStatusLabels: Record<string, string> = Object.fromEntries(
  paymentStatuses
    .filter((option) => option.value)
    .map((option) => [option.value, option.label]),
);

type OrderFilters = {
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export function orderListQueryKey(userId: string, filters: OrderFilters) {
  return ["orders", userId, filters] as const;
}

function dateBound(
  value: string,
  endOfDay: boolean,
): string | undefined | null {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
  );
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return date.toISOString();
}

function orderListPath(filters: OrderFilters): ApiPath {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  return `/orders?${params.toString()}` as ApiPath;
}

function FilterOption({
  label,
  group,
  selected,
  onPress,
}: {
  label: string;
  group: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${group}: ${label}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: selected ? "#176b57" : "#d6d3d1",
        borderRadius: 20,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: selected ? "#176b57" : "#44403c" }}>{label}</Text>
    </Pressable>
  );
}

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
        paddingHorizontal: 16,
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

export function OrderListScreen() {
  const router = useRouter();
  const { api, user } = useSession();
  const userId = user?.id;
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>(
    {},
  );
  const [dateError, setDateError] = useState("");
  const [page, setPage] = useState(1);
  const filters: OrderFilters = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...dateFilter,
    page,
    pageSize: PAGE_SIZE,
  };
  const queryKey = orderListQueryKey(userId ?? "signed-out", filters);
  const path = useMemo(
    () => orderListPath(filters),
    [
      filters.status,
      filters.paymentStatus,
      filters.from,
      filters.to,
      filters.page,
      filters.pageSize,
    ],
  );
  const ordersQuery = useQuery<OrderSummary[]>({
    queryKey,
    enabled: Boolean(userId),
    queryFn: ({ signal }) => api.request<OrderSummary[]>(path, { signal }),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === userId ? previousData : undefined,
  });

  function applyDates() {
    const from = dateBound(fromInput.trim(), false);
    const to = dateBound(toInput.trim(), true);
    if (from === null || to === null) {
      setDateError("Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.");
      return;
    }
    if (from && to && from > to) {
      setDateError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setDateError("");
    setDateFilter({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    setPage(1);
  }

  if (!userId) {
    return (
      <View style={{ flex: 1, gap: 16, padding: 20 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Đơn hàng
        </Text>
        <Text>Vui lòng đăng nhập để xem đơn hàng.</Text>
      </View>
    );
  }

  if (ordersQuery.isPending) {
    return (
      <View style={{ flex: 1, gap: 16, padding: 20 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Đơn hàng
        </Text>
        <Text accessibilityRole="progressbar">Đang tải đơn hàng…</Text>
      </View>
    );
  }

  if (ordersQuery.isError || !ordersQuery.data) {
    const forbidden =
      ordersQuery.error instanceof ApiClientError &&
      ordersQuery.error.status === 403;
    return (
      <View style={{ flex: 1, gap: 16, padding: 20 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Đơn hàng
        </Text>
        <Text accessibilityRole="alert">
          {forbidden
            ? "Bạn không có quyền xem đơn hàng."
            : "Không thể tải đơn hàng."}
        </Text>
        <ActionButton
          label="Thử lại"
          onPress={() => void ordersQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, gap: 16, padding: 20 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: "#57534e" }}>Tài khoản</Text>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Đơn hàng của tôi
        </Text>
      </View>
      {ordersQuery.isFetching ? (
        <Text accessibilityRole="progressbar">Đang cập nhật đơn hàng…</Text>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Trạng thái đơn hàng</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {statuses.map((option) => (
            <FilterOption
              key={option.value || "all-statuses"}
              group="Trạng thái"
              label={option.label}
              selected={status === option.value}
              onPress={() => {
                setStatus(option.value);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Thanh toán</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {paymentStatuses.map((option) => (
            <FilterOption
              key={option.value || "all-payment-statuses"}
              group="Thanh toán"
              label={option.label}
              selected={paymentStatus === option.value}
              onPress={() => {
                setPaymentStatus(option.value);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Khoảng ngày tạo</Text>
        <TextInput
          accessibilityLabel="Từ ngày"
          placeholder="YYYY-MM-DD"
          value={fromInput}
          onChangeText={setFromInput}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: "#d6d3d1",
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        />
        <TextInput
          accessibilityLabel="Đến ngày"
          placeholder="YYYY-MM-DD"
          value={toInput}
          onChangeText={setToInput}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: "#d6d3d1",
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        />
        <ActionButton label="Lọc theo ngày" onPress={applyDates} />
        {dateError ? <Text accessibilityRole="alert">{dateError}</Text> : null}
      </View>

      {ordersQuery.data.length === 0 ? (
        <View
          style={{
            gap: 12,
            borderWidth: 1,
            borderColor: "#d6d3d1",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text>Bạn chưa có đơn hàng nào.</Text>
          <ActionButton
            label="Khám phá sản phẩm"
            onPress={() => router.push("/products")}
          />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {ordersQuery.data.map((order) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              accessibilityLabel={`Đơn hàng ${order.orderNumber}`}
              onPress={() => router.push(`/orders/${order.id}`)}
              style={{
                gap: 8,
                borderWidth: 1,
                borderColor: "#d6d3d1",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: "700" }}>{order.orderNumber}</Text>
                <Text>{statusLabels[order.status] ?? order.status}</Text>
              </View>
              <Text>
                {new Date(order.createdAt).toLocaleString("vi-VN")} ·{" "}
                {paymentStatusLabels[order.paymentStatus] ??
                  order.paymentStatus}
              </Text>
              {order.partiallyCancelled ? <Text>Đã hủy một phần</Text> : null}
              <Text>
                Tổng đơn: {formatVnd(order.originalTotal)} · Còn phải trả:{" "}
                {formatVnd(order.outstandingAmount)}
              </Text>
            </Pressable>
          ))}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <ActionButton
              label="Trang trước"
              disabled={page <= 1 || ordersQuery.isFetching}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
            />
            <Text accessibilityLabel={`Trang ${page}`}>Trang {page}</Text>
            <ActionButton
              label="Trang sau"
              disabled={
                ordersQuery.isFetching || ordersQuery.data.length < PAGE_SIZE
              }
              onPress={() => setPage((current) => current + 1)}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
