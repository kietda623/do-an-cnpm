import React from "react";
import { useCallback, useState } from "react";
import { Button, FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { components } from "@marketplace/api-client";
import { useSession } from "../../features/auth/session-provider";
import { ApiResourceFeedback } from "../../features/api/api-resource-feedback";
import { useApiResource } from "../../features/api/use-api-resource";

type Product = components["schemas"]["ProductSummary"];
export default function Home() {
  const { api, user, logout } = useSession();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState(false);
  const handleLogout = useCallback(async () => {
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    }
  }, [logout]);
  const load = useCallback(() => api.request<Product[]>("/products"), [api]);
  const isEmpty = useCallback((items: Product[]) => items.length === 0, []);
  const { state, retry } = useApiResource(load, isEmpty);
  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Sản phẩm</Text>
      <Button
        title="Danh sách sản phẩm"
        onPress={() => router.push("/products")}
      />
      {user ? (
        <View>
          <Button title="Đăng xuất" onPress={() => void handleLogout()} />
          {logoutError ? (
            <View>
              <Text accessibilityRole="alert">
                Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.
              </Text>
              <Button title="Thử lại" onPress={() => void handleLogout()} />
            </View>
          ) : null}
        </View>
      ) : (
        <Button title="Đăng nhập" onPress={() => router.push("/login")} />
      )}
      <ApiResourceFeedback
        state={state}
        emptyMessage="Chưa có sản phẩm."
        onRetry={retry}
      />
      {state.status === "success" ? (
        <FlatList
          data={state.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Text>{item.name}</Text>}
        />
      ) : null}
    </View>
  );
}
