import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { components } from "@marketplace/api-client";
import { useSession } from "../auth/session-provider";
import {
  buildProductPath,
  CATALOG_PAGE_SIZE,
  isValidPriceRange,
  routePage,
  routeParam,
  type CatalogSort,
} from "./catalog-data";
import { CatalogQueryFeedback, ProductGridList } from "./catalog-ui";

type Params = {
  q?: string | string[];
  categoryId?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};
type Category = components["schemas"]["Category"];
type ProductSummary = components["schemas"]["ProductSummary"];

function readSort(value: string | undefined): CatalogSort {
  return value === "PRICE_ASC" || value === "PRICE_DESC" ? value : "NEWEST";
}

function routeValues(values: {
  q: string;
  categoryId: string;
  minPrice: string;
  maxPrice: string;
  sort: CatalogSort;
  page: number;
}) {
  return {
    ...(values.q ? { q: values.q } : {}),
    ...(values.categoryId ? { categoryId: values.categoryId } : {}),
    ...(values.minPrice ? { minPrice: values.minPrice } : {}),
    ...(values.maxPrice ? { maxPrice: values.maxPrice } : {}),
    sort: values.sort,
    page: String(values.page),
  };
}

export function ProductBrowser({
  pathname,
  title,
}: {
  pathname: "/products" | "/products/search";
  title: string;
}) {
  const { api } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const qParam = routeParam(params.q) ?? "";
  const categoryParam = routeParam(params.categoryId) ?? "";
  const minParam = routeParam(params.minPrice) ?? "";
  const maxParam = routeParam(params.maxPrice) ?? "";
  const sortParam = readSort(routeParam(params.sort));
  const pageParam = routePage(params.page);
  const [queryDraft, setQueryDraft] = useState(qParam);
  const [categoryDraft, setCategoryDraft] = useState(categoryParam);
  const [minDraft, setMinDraft] = useState(minParam);
  const [maxDraft, setMaxDraft] = useState(maxParam);
  const [sortDraft, setSortDraft] = useState<CatalogSort>(sortParam);

  useEffect(() => {
    setQueryDraft(qParam);
    setCategoryDraft(categoryParam);
    setMinDraft(minParam);
    setMaxDraft(maxParam);
    setSortDraft(sortParam);
  }, [qParam, categoryParam, minParam, maxParam, sortParam]);

  const rangeValid = isValidPriceRange(minParam, maxParam);
  const activeFilters = useMemo(
    () => ({
      q: qParam,
      categoryId: categoryParam,
      minPrice: minParam,
      maxPrice: maxParam,
      sort: sortParam,
      page: pageParam,
    }),
    [qParam, categoryParam, minParam, maxParam, sortParam, pageParam],
  );
  const productPath = buildProductPath(activeFilters);
  const categories = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: ({ signal }) => api.request<Category[]>("/categories", { signal }),
  });
  const products = useQuery({
    queryKey: ["catalog", "products", activeFilters],
    enabled: rangeValid,
    queryFn: ({ signal }) =>
      api.request<ProductSummary[]>(productPath, { signal }),
  });

  function applyFilters() {
    if (!isValidPriceRange(minDraft, maxDraft)) return;
    router.replace({
      pathname,
      params: routeValues({
        q: queryDraft.trim(),
        categoryId: categoryDraft,
        minPrice: minDraft,
        maxPrice: maxDraft,
        sort: sortDraft,
        page: 1,
      }),
    });
  }

  function changePage(page: number) {
    router.replace({
      pathname,
      params: routeValues({ ...activeFilters, page }),
    });
  }

  function resetFilters() {
    setQueryDraft("");
    setCategoryDraft("");
    setMinDraft("");
    setMaxDraft("");
    setSortDraft("NEWEST");
    router.replace({ pathname, params: { sort: "NEWEST", page: "1" } });
  }

  const header = (
    <View style={{ gap: 16, padding: 10 }}>
      <View>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: "700" }}
        >
          {title}
        </Text>
        <Text>Tìm kiếm, lọc và sắp xếp sản phẩm đang được bán.</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text>Tìm sản phẩm</Text>
        <TextInput
          accessibilityLabel="Tìm sản phẩm"
          value={queryDraft}
          onChangeText={setQueryDraft}
          onSubmitEditing={applyFilters}
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
      </View>
      <View style={{ gap: 8 }}>
        <Text>Danh mục</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Danh mục Tất cả"
            accessibilityState={{ selected: !categoryDraft }}
            onPress={() => setCategoryDraft("")}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text>Tất cả</Text>
          </Pressable>
          {(categories.data ?? []).map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="radio"
              accessibilityLabel={`Danh mục ${category.name}`}
              accessibilityState={{ selected: categoryDraft === category.id }}
              onPress={() => setCategoryDraft(category.id)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <Text>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {categories.error ? (
          <CatalogQueryFeedback
            loading={false}
            error={categories.error}
            empty={false}
            emptyMessage=""
            onRetry={() => void categories.refetch()}
          />
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text>Sắp xếp</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["NEWEST", "Mới nhất"],
              ["PRICE_ASC", "Giá tăng dần"],
              ["PRICE_DESC", "Giá giảm dần"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`Sắp xếp ${label}`}
              accessibilityState={{ selected: sortDraft === value }}
              onPress={() => setSortDraft(value)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
              }}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text>Giá từ</Text>
          <TextInput
            accessibilityLabel="Giá từ"
            value={minDraft}
            onChangeText={(value) => setMinDraft(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: "#bdbdc5",
              borderRadius: 8,
              paddingHorizontal: 12,
            }}
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text>Giá đến</Text>
          <TextInput
            accessibilityLabel="Giá đến"
            value={maxDraft}
            onChangeText={(value) => setMaxDraft(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: "#bdbdc5",
              borderRadius: 8,
              paddingHorizontal: 12,
            }}
          />
        </View>
      </View>
      {!isValidPriceRange(minDraft, maxDraft) || !rangeValid ? (
        <Text accessibilityRole="alert">
          Giá phải là số nguyên tối đa 18 chữ số và giá từ không được lớn hơn
          giá đến.
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Áp dụng bộ lọc" onPress={applyFilters} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Xóa bộ lọc" onPress={resetFilters} />
        </View>
      </View>
      {rangeValid && products.data ? (
        <Text accessibilityLiveRegion="polite">
          {products.data.length} sản phẩm trên trang này
        </Text>
      ) : null}
    </View>
  );
  const footer = products.data?.length ? (
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
        disabled={pageParam <= 1}
        onPress={() => changePage(pageParam - 1)}
        style={{
          minHeight: 44,
          justifyContent: "center",
          opacity: pageParam <= 1 ? 0.45 : 1,
        }}
      >
        <Text>Trang trước</Text>
      </Pressable>
      <Text>Trang {pageParam}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={products.data.length < CATALOG_PAGE_SIZE}
        onPress={() => changePage(pageParam + 1)}
        style={{
          minHeight: 44,
          justifyContent: "center",
          opacity: products.data.length < CATALOG_PAGE_SIZE ? 0.45 : 1,
        }}
      >
        <Text>Trang sau</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <ProductGridList
      products={products.data ?? []}
      loading={products.isPending && rangeValid}
      error={!rangeValid ? undefined : products.error}
      emptyMessage="Chưa tìm thấy sản phẩm phù hợp. Hãy đổi hoặc xóa bộ lọc."
      onRetry={() => void products.refetch()}
      header={header}
      footer={footer}
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
  );
}
