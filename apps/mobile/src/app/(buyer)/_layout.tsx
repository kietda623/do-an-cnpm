import React, { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";
import { Stack, usePathname, useRouter } from "expo-router";
import { useSession } from "../../features/auth/session-provider";
import { safeBuyerReturnTo } from "../../navigation/return-to";

export default function BuyerLayout() {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState(false);
  const returnTo = safeBuyerReturnTo(pathname);

  useEffect(() => {
    if (!user && returnTo !== "/")
      router.replace({ pathname: "/login", params: { returnTo } });
  }, [returnTo, router, user]);

  async function handleLogout() {
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    }
  }

  if (!user) return null;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 }}
      >
        <Button title="Giỏ hàng" onPress={() => router.push("/cart")} />
        <Button title="Thanh toán" onPress={() => router.push("/checkout")} />
        <Button title="Đơn hàng" onPress={() => router.push("/orders")} />
        <Button title="Hồ sơ" onPress={() => router.push("/account")} />
        <Button
          title="Địa chỉ"
          onPress={() => router.push("/account/addresses")}
        />
        <Button title="Đăng xuất" onPress={() => void handleLogout()} />
      </View>
      {logoutError ? (
        <View>
          <Text accessibilityRole="alert">
            Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.
          </Text>
          <Button
            title="Thử lại đăng xuất"
            onPress={() => void handleLogout()}
          />
        </View>
      ) : null}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
