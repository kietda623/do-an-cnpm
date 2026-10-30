import React, { useEffect, useState } from "react";
import {
  Button,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiPath, components } from "@marketplace/api-client";
import { useSession } from "../../../features/auth/session-provider";
import { apiErrorMessage } from "../../../features/api/error-message";
import {
  buildReviewsPath,
  CATALOG_PAGE_SIZE,
  formatVnd,
  routeParam,
} from "../../../features/catalog/catalog-data";
import { CatalogQueryFeedback } from "../../../features/catalog/catalog-ui";

type Product = components["schemas"]["DiscoveryProduct"];
type Review = components["schemas"]["Review"];

function ProductReviews({
  api,
  product,
}: {
  api: ReturnType<typeof useSession>["api"];
  product: Product;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [product.id]);
  const reviews = useQuery({
    queryKey: ["catalog", "reviews", product.id, page],
    queryFn: ({ signal }) =>
      api.request<Review[]>(buildReviewsPath(product.id, page), { signal }),
  });
  const rows = reviews.data ?? [];

  return (
    <View style={{ gap: 10, paddingVertical: 16 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 20, fontWeight: "700" }}
      >
        Đánh giá sản phẩm
      </Text>
      <Text>
        {product.ratingAverage
          ? Number(product.ratingAverage).toLocaleString("vi-VN", {
              maximumFractionDigits: 1,
            }) + "/5"
          : "Chưa có điểm"}{" "}
        · {product.ratingCount} đánh giá
      </Text>
      {reviews.isPending || reviews.error || rows.length === 0 ? (
        <CatalogQueryFeedback
          loading={reviews.isPending}
          error={reviews.error}
          empty={!reviews.isPending && !reviews.error}
          emptyMessage="Chưa có đánh giá."
          onRetry={() => void reviews.refetch()}
        />
      ) : (
        <View style={{ gap: 14 }}>
          {rows.map((review) => (
            <View
              key={review.id}
              style={{
                borderTopWidth: 1,
                borderColor: "#dedee3",
                paddingTop: 12,
                gap: 5,
              }}
            >
              <Text style={{ fontWeight: "600" }}>
                {review.buyerDisplayName} · {review.rating}/5
              </Text>
              <Text>{review.comment}</Text>
              <Text>
                {new Date(review.createdAt).toLocaleDateString("vi-VN")}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={page === 1}
          onPress={() => setPage((current) => current - 1)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            opacity: page === 1 ? 0.45 : 1,
          }}
        >
          <Text>Trang trước</Text>
        </Pressable>
        <Text>Đánh giá · trang {page}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={rows.length < CATALOG_PAGE_SIZE}
          onPress={() => setPage((current) => current + 1)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            opacity: rows.length < CATALOG_PAGE_SIZE ? 0.45 : 1,
          }}
        >
          <Text>Trang sau</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProductDetailRoute() {
  const { api, user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { productId: rawProductId } = useLocalSearchParams<{
    productId?: string | string[];
  }>();
  const productId = routeParam(rawProductId) ?? "";
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const productQuery = useQuery({
    queryKey: ["catalog", "product", productId],
    enabled: Boolean(productId),
    queryFn: ({ signal }) =>
      api.request<Product>(
        ("/products/" + encodeURIComponent(productId)) as ApiPath,
        { signal },
      ),
  });
  const product = productQuery.data;
  const variant =
    product?.variants.find((item) => item.id === variantId) ??
    product?.variants[0];
  useEffect(() => {
    setImageIndex(0);
    setVariantId("");
    setQuantity(1);
  }, [productId]);
  useEffect(() => {
    setQuantity(1);
  }, [variant?.id]);
  const addToCart = useMutation({
    mutationFn: () => {
      if (!variant) throw new Error("Chưa chọn phân loại sản phẩm.");
      return api.request("/cart/items" as ApiPath, {
        method: "POST",
        body: JSON.stringify({ variantId: variant.id, quantity }),
      });
    },
    onSuccess: async () => {
      if (user)
        await queryClient.invalidateQueries({ queryKey: ["cart", user.id] });
    },
    retry: false,
  });

  if (productQuery.isPending || productQuery.error || !product)
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <CatalogQueryFeedback
          loading={productQuery.isPending}
          error={productQuery.error}
          empty={false}
          emptyMessage=""
          notFoundMessage="Sản phẩm không tồn tại hoặc hiện không được bán công khai."
          onRetry={() => void productQuery.refetch()}
        />
        <Button
          title="Quay lại danh sách"
          onPress={() => router.push("/products")}
        />
      </View>
    );

  const images = product.images;
  const selectedImage = images[imageIndex] ?? images[0];
  const variantLabel = (item: Product["variants"][number]) =>
    Object.values(item.attributes).map(String).join(" / ") || item.sku;
  const addDisabled =
    !variant ||
    quantity > Math.min(variant.availableQuantity, 999) ||
    addToCart.isPending;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 32 }}
    >
      <View style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/shops/[shopId]",
              params: { shopId: product.shop.id },
            })
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text>Cửa hàng · {product.shop.name}</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: "700" }}
        >
          {product.name}
        </Text>
      </View>
      {selectedImage ? (
        <Image
          source={{ uri: selectedImage.url }}
          accessibilityLabel={
            "Ảnh sản phẩm " +
            product.name +
            " " +
            (imageIndex + 1) +
            "/" +
            images.length
          }
          style={{
            width: "100%",
            height: 280,
            backgroundColor: "#f1f1f4",
            borderRadius: 12,
          }}
          resizeMode="cover"
        />
      ) : null}
      <FlatList
        horizontal
        data={images}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Xem ảnh " + (index + 1)}
            accessibilityState={{ selected: imageIndex === index }}
            onPress={() => setImageIndex(index)}
            style={{
              minWidth: 64,
              minHeight: 64,
              borderWidth: imageIndex === index ? 2 : 1,
              borderColor: imageIndex === index ? "#5555aa" : "#dedee3",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: item.url }}
              style={{ width: 64, height: 64 }}
              resizeMode="cover"
            />
          </Pressable>
        )}
      />
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>
          {formatVnd(variant?.price ?? product.minimumPrice)}
        </Text>
        <Text>Phân loại</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {product.variants.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityLabel={"Phân loại " + variantLabel(item)}
              accessibilityState={{ selected: (variant?.id ?? "") === item.id }}
              onPress={() => setVariantId(item.id)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor:
                  (variant?.id ?? "") === item.id ? "#5555aa" : "#dedee3",
                borderRadius: 8,
              }}
            >
              <Text>
                {variantLabel(item)} · {formatVnd(item.price)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text accessibilityLiveRegion="polite">
          {variant?.availableQuantity
            ? "Còn " + variant.availableQuantity + " sản phẩm"
            : "Tạm hết hàng"}
        </Text>
        {variant && variant.availableQuantity > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Giảm số lượng"
              disabled={quantity <= 1}
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>−</Text>
            </Pressable>
            <Text accessibilityLabel={"Số lượng " + quantity}>{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tăng số lượng"
              disabled={quantity >= Math.min(variant.availableQuantity, 999)}
              onPress={() =>
                setQuantity((current) =>
                  Math.min(variant.availableQuantity, 999, current + 1),
                )
              }
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text>+</Text>
            </Pressable>
          </View>
        ) : null}
        {user ? (
          <View style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={addDisabled}
              onPress={() => addToCart.mutate()}
              style={{
                minHeight: 48,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: addDisabled ? "#b8b8c2" : "#43438a",
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                {addToCart.isPending
                  ? "Đang thêm…"
                  : addToCart.isSuccess
                    ? "Đã thêm vào giỏ"
                    : variant?.availableQuantity
                      ? "Thêm vào giỏ hàng"
                      : "Tạm hết hàng"}
              </Text>
            </Pressable>
            {addToCart.error ? (
              <Text accessibilityRole="alert">
                {apiErrorMessage(
                  addToCart.error,
                  "Không thể thêm sản phẩm vào giỏ.",
                )}
              </Text>
            ) : null}
            {addToCart.isSuccess ? (
              <Button
                title="Xem giỏ hàng"
                onPress={() => router.push("/cart")}
              />
            ) : null}
          </View>
        ) : variant?.availableQuantity ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/login",
                params: { returnTo: "/products/" + product.id },
              })
            }
            style={{
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#43438a",
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Đăng nhập để mua
            </Text>
          </Pressable>
        ) : (
          <Text>Tạm hết hàng</Text>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: "700" }}
        >
          Mô tả
        </Text>
        <Text>{product.description}</Text>
      </View>
      <ProductReviews api={api} product={product} />
    </ScrollView>
  );
}
