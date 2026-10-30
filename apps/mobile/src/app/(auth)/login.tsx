import React from "react";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      router.replace(safeBuyerReturnTo(returnTo));
    } catch {
      setError("Đăng nhập không thành công. Vui lòng thử lại.");
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
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Mật khẩu"
        secureTextEntry
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
        title="Đăng ký (đang phát triển — T135)"
        onPress={() => router.push("/register")}
      />
    </View>
  );
}
