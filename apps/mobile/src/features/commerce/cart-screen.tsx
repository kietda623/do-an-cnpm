import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiClientError,
  type ApiPath,
  type components,
} from "@marketplace/api-client";
import { useRouter } from "expo-router";
import { useSession } from "../auth/session-provider";
import { formatVnd } from "../catalog/catalog-data";

type Cart = components["schemas"]["Cart"];
type CartItem = components["schemas"]["CartItem"];
type CartPatch = components["schemas"]["CartPatch"];

export const cartQueryKey = (userId: string) => ["cart", userId] as const;

const pageStyle: StyleProp<ViewStyle> = {
  flexGrow: 1,
  gap: 16,
  padding: 20,
};
const cardStyle: StyleProp<ViewStyle> = {
  gap: 12,
  borderWidth: 1,
  borderColor: "#d6d3d1",
  borderRadius: 12,
  padding: 16,
};
const buttonStyle: StyleProp<ViewStyle> = {
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  backgroundColor: "#176b57",
  paddingHorizontal: 16,
};

function buttonText(disabled = false) {
  return {
    color: disabled ? "#57534e" : "#ffffff",
    fontWeight: "600" as const,
  };
}

function CartButton({
  label,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        buttonStyle,
        disabled ? { backgroundColor: "#e7e5e4" } : undefined,
        style,
      ]}
    >
      <Text style={buttonText(disabled)}>{label}</Text>
    </Pressable>
  );
}

function CartLine({
  item,
  disabled,
  update,
  remove,
}: {
  item: CartItem;
  disabled: boolean;
  update: (changes: CartPatch) => void;
  remove: () => void;
}) {
  const maximumQuantity = Math.min(999, Math.max(1, item.availableQuantity));
  const cannotIncrease = item.quantity >= maximumQuantity;
  const attributes = Object.values(item.attributes).join(" / ") || item.sku;

  return (
    <View
      style={{
        gap: 8,
        borderTopWidth: 1,
        borderColor: "#e7e5e4",
        paddingTop: 12,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Chọn ${item.productName}`}
        accessibilityState={{ checked: item.selected, disabled }}
        disabled={disabled}
        onPress={() => update({ selected: !item.selected })}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Text>{item.selected ? "☑" : "☐"}</Text>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>
          {item.productName}
        </Text>
      </Pressable>
      <Text style={{ color: "#57534e" }}>{attributes}</Text>
      <Text style={{ fontWeight: "600" }}>
        {formatVnd(item.currentUnitPrice)}
      </Text>
      {!item.purchasable ? (
        <Text accessibilityRole="alert" style={{ color: "#b42318" }}>
          {item.unavailableReason === "INSUFFICIENT_STOCK"
            ? "Số lượng vượt tồn kho"
            : "Sản phẩm hiện không khả dụng"}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CartButton
          label={`Giảm số lượng ${item.productName}`}
          disabled={disabled || item.quantity <= 1}
          onPress={() => update({ quantity: item.quantity - 1 })}
          style={{ minWidth: 48, paddingHorizontal: 8 }}
        />
        <Text accessibilityLabel={`Số lượng ${item.productName}`}>
          {item.quantity}
        </Text>
        <CartButton
          label={`Tăng số lượng ${item.productName}`}
          disabled={disabled || cannotIncrease}
          onPress={() => update({ quantity: item.quantity + 1 })}
          style={{ minWidth: 48, paddingHorizontal: 8 }}
        />
        <CartButton
          label={`Xóa ${item.productName}`}
          disabled={disabled}
          onPress={remove}
          style={{ marginLeft: "auto" }}
        />
      </View>
    </View>
  );
}

export function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api, user } = useSession();
  const userId = user?.id;
  const queryKey = userId
    ? cartQueryKey(userId)
    : (["cart", "signed-out"] as const);

  const cartQuery = useQuery<Cart>({
    queryKey,
    enabled: Boolean(userId),
    queryFn: ({ signal }) => api.request<Cart>("/cart", { signal }),
  });

  const updateItem = useMutation<
    Cart,
    Error,
    { id: string; changes: CartPatch }
  >({
    mutationFn: ({ id, changes }) =>
      api.request<Cart>(`/cart/items/${encodeURIComponent(id)}` as ApiPath, {
        method: "PATCH",
        body: JSON.stringify(changes),
      }),
    onSuccess: (cart) => {
      if (userId) queryClient.setQueryData(cartQueryKey(userId), cart);
    },
  });

  const removeItem = useMutation<void, Error, string>({
    mutationFn: (id) =>
      api.request<void>(`/cart/items/${encodeURIComponent(id)}` as ApiPath, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      if (userId)
        await queryClient.invalidateQueries({ queryKey: cartQueryKey(userId) });
    },
  });

  const pending = updateItem.isPending || removeItem.isPending;
  const error = cartQuery.error;
  const isForbidden = error instanceof ApiClientError && error.status === 403;
  const actionError = updateItem.error ?? removeItem.error;

  if (!userId) {
    return (
      <View style={pageStyle}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Giỏ hàng
        </Text>
        <Text>Vui lòng đăng nhập để xem giỏ hàng.</Text>
      </View>
    );
  }

  if (cartQuery.isPending) {
    return (
      <View style={pageStyle}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Giỏ hàng
        </Text>
        <Text accessibilityRole="progressbar">Đang tải giỏ hàng…</Text>
      </View>
    );
  }

  if (cartQuery.isError || !cartQuery.data) {
    return (
      <View style={pageStyle}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Giỏ hàng
        </Text>
        <Text accessibilityRole="alert">
          {isForbidden
            ? "Bạn không có quyền xem giỏ hàng."
            : "Không thể tải giỏ hàng."}
        </Text>
        <CartButton label="Thử lại" onPress={() => void cartQuery.refetch()} />
      </View>
    );
  }

  const cart = cartQuery.data;
  const groups = cart.groups.filter((group) => group.items.length > 0);
  const isEmpty = groups.length === 0;

  return (
    <ScrollView contentContainerStyle={pageStyle}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: "#57534e" }}>Mua sắm</Text>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: "700" }}
        >
          Giỏ hàng
        </Text>
        <CartButton
          label="Tiếp tục mua sắm"
          onPress={() => router.push("/products")}
          style={{ alignSelf: "flex-start" }}
        />
      </View>

      {actionError ? (
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="alert">
            {actionError.message || "Không thể cập nhật giỏ hàng."}
          </Text>
          <CartButton
            label="Đồng bộ lại giỏ hàng"
            onPress={() => {
              updateItem.reset();
              removeItem.reset();
              void cartQuery.refetch();
            }}
          />
        </View>
      ) : null}

      {isEmpty ? (
        <View style={cardStyle}>
          <Text>Giỏ hàng đang trống.</Text>
        </View>
      ) : (
        <>
          {groups.map((group) => (
            <View key={group.shopId} style={cardStyle}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>
                {group.shopName}
              </Text>
              {group.items.map((item) => (
                <CartLine
                  key={item.id}
                  item={item}
                  disabled={pending}
                  update={(changes) =>
                    updateItem.mutate({ id: item.id, changes })
                  }
                  remove={() => removeItem.mutate(item.id)}
                />
              ))}
              <Text>
                Tạm tính cửa hàng: {formatVnd(group.selectedSubtotal)}
              </Text>
            </View>
          ))}

          <View style={cardStyle}>
            <Text style={{ fontSize: 18, fontWeight: "600" }}>Tạm tính</Text>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text>Tổng đã chọn</Text>
              <Text style={{ fontWeight: "700" }}>
                {formatVnd(cart.selectedTotal)}
              </Text>
            </View>
            <CartButton
              label="Tiến hành đặt hàng"
              disabled={cart.selectedTotal === "0"}
              onPress={() => router.push("/checkout")}
            />
            <Text style={{ color: "#57534e" }}>
              Giá và tồn kho sẽ được xác nhận lại khi tạo báo giá.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
