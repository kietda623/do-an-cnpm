import React, { useCallback, useState } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { components } from "@marketplace/api-client";
import { useSession } from "../../features/auth/session-provider";
import { buildProductPath } from "../../features/catalog/catalog-data";
import {
  CatalogQueryFeedback,
  ProductGridList,
} from "../../features/catalog/catalog-ui";

type ProductSummary = components["schemas"]["ProductSummary"];
type Category = components["schemas"]["Category"];

export default function Home() {
  const { api, user, logout } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [logoutError, setLogoutError] = useState(false);
  const products = useQuery({
    queryKey: ["catalog", "products", { home: true }],
    queryFn: ({ signal }) =>
      api.request<ProductSummary[]>(
        buildProductPath({ sort: "NEWEST", page: 1 }),
        { signal },
      ),
  });
  const categories = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: ({ signal }) => api.request<Category[]>("/categories", { signal }),
  });
  const handleLogout = useCallback(async () => {
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    }
  }, [logout]);
  const openSearch = useCallback(
    (categoryId?: string) => {
      const q = search.trim();
      router.push({
        pathname: "/products/search",
        params: { ...(q ? { q } : {}), ...(categoryId ? { categoryId } : {}) },
      });
    },
    [router, search],
  );
  const header = (
    <View style={{ gap: 16, padding: 10 }}>
      <View>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 26, fontWeight: "700" }}
        >
          Khám phá sản phẩm
        </Text>
        <Text>Sản phẩm đang được bán từ các cửa hàng công khai.</Text>
      </View>
      <View style={{ gap: 8 }}>
        <TextInput
          accessibilityLabel="Tìm sản phẩm"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => openSearch()}
          placeholder="Tên hoặc mô tả sản phẩm"
          returnKeyType="search"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: "#bdbdc5",
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        />
        <Button title="Tìm kiếm" onPress={() => openSearch()} />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Danh sách sản phẩm"
            onPress={() => router.push("/products")}
          />
        </View>
        {user ? (
          <View style={{ flex: 1 }}>
            <Button title="Đăng xuất" onPress={() => void handleLogout()} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Button title="Đăng nhập" onPress={() => router.push("/login")} />
          </View>
        )}
      </View>
      {logoutError ? (
        <View>
          <Text accessibilityRole="alert">
            Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.
          </Text>
          <Button title="Thử lại" onPress={() => void handleLogout()} />
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Danh mục</Text>
        {categories.isPending ? (
          <CatalogQueryFeedback
            loading
            empty={false}
            emptyMessage=""
            onRetry={() => void categories.refetch()}
          />
        ) : categories.error ? (
          <CatalogQueryFeedback
            loading={false}
            error={categories.error}
            empty={false}
            emptyMessage=""
            onRetry={() => void categories.refetch()}
          />
        ) : categories.data?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.data.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                onPress={() => openSearch(category.id)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: "#dedee3",
                  borderRadius: 18,
                }}
              >
                <Text>{category.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text>Chưa có danh mục.</Text>
        )}
      </View>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Sản phẩm mới</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ProductGridList
        products={products.data ?? []}
        loading={products.isPending}
        error={products.error}
        emptyMessage="Chưa có sản phẩm."
        onRetry={() => void products.refetch()}
        header={header}
        onProductPress={(item) =>
          router.push({
            pathname: "/products/[productId]",
            params: { productId: item.id },
          })
        }
        onShopPress={(item) =>
          router.push({
            pathname: "/shops/[shopId]",
            params: { shopId: item.shopId },
          })
        }
      />
    </View>
  );
}
