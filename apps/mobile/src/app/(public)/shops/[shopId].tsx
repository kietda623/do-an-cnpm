import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ApiPath, components } from "@marketplace/api-client";
import { useSession } from "../../../features/auth/session-provider";
import {
  CATALOG_PAGE_SIZE,
  routePage,
  routeParam,
} from "../../../features/catalog/catalog-data";
import {
  CatalogQueryFeedback,
  ProductGridList,
} from "../../../features/catalog/catalog-ui";

type ShopPublic = components["schemas"]["ShopPublic"];
type ProductSummary = components["schemas"]["ProductSummary"];

export default function PublicShopRoute() {
  const { api } = useSession();
  const router = useRouter();
  const { shopId: rawShopId, page: rawPage } = useLocalSearchParams<{
    shopId?: string | string[];
    page?: string | string[];
  }>();
  const shopId = routeParam(rawShopId) ?? "";
  const page = routePage(rawPage);
  const shopQuery = useQuery({
    queryKey: ["catalog", "shop", shopId],
    enabled: Boolean(shopId),
    queryFn: ({ signal }) =>
      api.request<ShopPublic>(
        ("/shops/" + encodeURIComponent(shopId)) as ApiPath,
        { signal },
      ),
  });
  const productsQuery = useQuery({
    queryKey: ["catalog", "shop-products", shopId, page],
    enabled: Boolean(shopId && shopQuery.data),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        shopId,
        sort: "NEWEST",
        page: String(page),
        pageSize: String(CATALOG_PAGE_SIZE),
      });
      return api.request<ProductSummary[]>(`/products?${params}` as ApiPath, {
        signal,
      });
    },
  });

  if (shopQuery.isPending || shopQuery.error || !shopQuery.data) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <CatalogQueryFeedback
          loading={shopQuery.isPending}
          error={shopQuery.error}
          empty={false}
          emptyMessage=""
          notFoundMessage="Cửa hàng không tồn tại hoặc chưa mở bán công khai."
          onRetry={() => void shopQuery.refetch()}
        />
      </View>
    );
  }

  const shop = shopQuery.data;
  const header = (
    <View style={{ gap: 14, padding: 10 }}>
      {shop.banner ? (
        <Image
          source={{ uri: shop.banner.url }}
          accessibilityLabel={`Ảnh bìa cửa hàng ${shop.name}`}
          style={{ height: 150, borderRadius: 12, backgroundColor: "#f1f1f4" }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image
          source={{ uri: shop.logo.url }}
          accessibilityLabel={`Logo cửa hàng ${shop.name}`}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#f1f1f4",
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, fontWeight: "700" }}
          >
            {shop.name}
          </Text>
          <Text>@{shop.slug}</Text>
        </View>
      </View>
      <Text>{shop.description}</Text>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Sản phẩm cửa hàng</Text>
    </View>
  );
  const rows = productsQuery.data ?? [];
  const footer =
    rows.length || page > 1 ? (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          paddingVertical: 16,
        }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={page <= 1}
          onPress={() =>
            router.replace({
              pathname: "/shops/[shopId]",
              params: { shopId, page: String(page - 1) },
            })
          }
          style={{
            minHeight: 44,
            justifyContent: "center",
            opacity: page <= 1 ? 0.45 : 1,
          }}
        >
          <Text>Trang trước</Text>
        </Pressable>
        <Text>Trang {page}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={rows.length < CATALOG_PAGE_SIZE}
          onPress={() =>
            router.replace({
              pathname: "/shops/[shopId]",
              params: { shopId, page: String(page + 1) },
            })
          }
          style={{
            minHeight: 44,
            justifyContent: "center",
            opacity: rows.length < CATALOG_PAGE_SIZE ? 0.45 : 1,
          }}
        >
          <Text>Trang sau</Text>
        </Pressable>
      </View>
    ) : null;

  return (
    <ProductGridList
      products={rows}
      loading={productsQuery.isPending}
      error={productsQuery.error}
      emptyMessage="Cửa hàng chưa có sản phẩm đang bán."
      onRetry={() => void productsQuery.refetch()}
      header={header}
      footer={footer}
      onProductPress={(product) =>
        router.push({
          pathname: "/products/[productId]",
          params: { productId: product.id },
        })
      }
    />
  );
}
