import React from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { components } from "@marketplace/api-client";
import { useSession } from "../features/auth/session-provider";

type Product = components["schemas"]["ProductSummary"];
export default function Home() {
  const { api, user, logout } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const load = useCallback(async () => {
    setState("loading");
    try {
      setProducts(await api.request<Product[]>("/products"));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Sản phẩm</Text>
      {user ? (
        <Button title="Đăng xuất" onPress={() => void logout()} />
      ) : (
        <Button title="Đăng nhập" onPress={() => router.push("/login")} />
      )}
      {state === "loading" ? (
        <ActivityIndicator accessibilityLabel="Đang tải sản phẩm" />
      ) : null}
      {state === "error" ? (
        <View>
          <Text accessibilityRole="alert">Không thể tải sản phẩm.</Text>
          <Button title="Thử lại" onPress={() => void load()} />
        </View>
      ) : null}
      {state === "ready" ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Text>{item.name}</Text>}
          ListEmptyComponent={<Text>Chưa có sản phẩm.</Text>}
        />
      ) : null}
    </View>
  );
}
