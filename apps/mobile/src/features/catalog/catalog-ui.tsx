import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { ApiClientError, type components } from "@marketplace/api-client";
import { formatVnd } from "./catalog-data";

type ProductSummary = components["schemas"]["ProductSummary"];

export function CatalogQueryFeedback({
  loading,
  error,
  empty,
  emptyMessage,
  notFoundMessage,
  onRetry,
}: {
  loading: boolean;
  error?: unknown;
  empty: boolean;
  emptyMessage: string;
  notFoundMessage?: string;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{ padding: 24, alignItems: "center" }}
      >
        <ActivityIndicator accessibilityLabel="Đang tải dữ liệu" />
        <Text style={{ marginTop: 8 }}>Đang tải dữ liệu…</Text>
      </View>
    );
  if (
    error instanceof ApiClientError &&
    error.status === 404 &&
    notFoundMessage
  )
    return (
      <View style={{ padding: 20, gap: 12 }}>
        <Text accessibilityRole="alert">{notFoundMessage}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text>Thử tải lại</Text>
        </Pressable>
      </View>
    );
  if (error instanceof ApiClientError && error.status === 403)
    return (
      <Text accessibilityRole="alert" style={{ padding: 20 }}>
        Bạn không có quyền xem nội dung này.
      </Text>
    );
  if (error)
    return (
      <View style={{ padding: 20, gap: 12 }}>
        <Text accessibilityRole="alert">
          Không thể tải dữ liệu. Kiểm tra kết nối rồi thử lại.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text>Thử lại</Text>
        </Pressable>
      </View>
    );
  if (empty) return <Text style={{ padding: 20 }}>{emptyMessage}</Text>;
  return null;
}

export function ProductCard({
  product,
  onPress,
  onShopPress,
}: {
  product: ProductSummary;
  onPress: () => void;
  onShopPress?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        margin: 6,
        borderWidth: 1,
        borderColor: "#dedee3",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "white",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mở sản phẩm ${product.name}`}
        onPress={onPress}
        style={{ minHeight: 44 }}
      >
        {product.image ? (
          <Image
            source={{ uri: product.image.url }}
            accessibilityLabel={`Ảnh ${product.name}`}
            style={{ width: "100%", height: 144, backgroundColor: "#f1f1f4" }}
            resizeMode="cover"
          />
        ) : (
          <View
            accessibilityLabel="Chưa có ảnh sản phẩm"
            style={{ height: 144, backgroundColor: "#f1f1f4" }}
          />
        )}
        <View style={{ padding: 10, gap: 5 }}>
          <Text numberOfLines={2}>{product.name}</Text>
          <Text style={{ fontWeight: "700" }}>
            {formatVnd(product.minimumPrice)}
          </Text>
          <Text>{product.available ? "Còn hàng" : "Tạm hết hàng"}</Text>
          <Text>{product.ratingCount} đánh giá</Text>
        </View>
      </Pressable>
      {onShopPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mở cửa hàng ${product.shopName}`}
          onPress={onShopPress}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 10,
          }}
        >
          <Text numberOfLines={1} style={{ textDecorationLine: "underline" }}>
            {product.shopName}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProductGridList({
  products,
  loading,
  error,
  emptyMessage,
  onRetry,
  onProductPress,
  onShopPress,
  header,
  footer,
}: {
  products: ProductSummary[];
  loading: boolean;
  error?: unknown;
  emptyMessage: string;
  onRetry: () => void;
  onProductPress: (product: ProductSummary) => void;
  onShopPress?: (product: ProductSummary) => void;
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
}) {
  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 2 }}
      contentContainerStyle={{ padding: 10, paddingBottom: 28 }}
      ListHeaderComponent={header ?? null}
      ListFooterComponent={footer ?? null}
      ListEmptyComponent={
        <CatalogQueryFeedback
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage={emptyMessage}
          onRetry={onRetry}
        />
      }
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onPress={() => onProductPress(item)}
          onShopPress={onShopPress ? () => onShopPress(item) : undefined}
        />
      )}
    />
  );
}
