import React from "react";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiErrorMessage } from "../../features/api/error-message";
import { useSession } from "../../features/auth/session-provider";
import { safeBuyerReturnTo } from "../../navigation/return-to";

export default function Login() {
  const { login } = useSession();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const normalizedEmail = email.trim();
    if (
      normalizedEmail.length < 3 ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError("Vui lòng nhập email hợp lệ.");
      return;
    }
    if (password.length < 1 || password.length > 128) {
      setError("Mật khẩu phải có từ 1 đến 128 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(normalizedEmail, password);
      router.replace(safeBuyerReturnTo(returnTo));
    } catch (cause) {
      setError(
        apiErrorMessage(cause, "Đăng nhập không thành công. Vui lòng thử lại."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Đăng nhập</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        maxLength={254}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Mật khẩu"
        secureTextEntry
        maxLength={128}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button
        title={busy ? "Đang đăng nhập…" : "Đăng nhập"}
        disabled={busy}
        onPress={() => void submit()}
      />
      <Button
        title="Tạo tài khoản"
        onPress={() =>
          router.push({
            pathname: "/register",
            params: { returnTo: safeBuyerReturnTo(returnTo) },
          })
        }
      />
    </View>
  );
}
