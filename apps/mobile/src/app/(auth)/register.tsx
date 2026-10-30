import React, { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiErrorMessage } from "../../features/api/error-message";
import { useSession } from "../../features/auth/session-provider";
import { safeBuyerReturnTo } from "../../navigation/return-to";

export default function Register() {
  const { register } = useSession();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = fullName.trim();
    const address = email.trim();
    if (name.length < 1 || name.length > 120) {
      setError("Họ và tên phải có từ 1 đến 120 ký tự.");
      return;
    }
    if (
      address.length < 3 ||
      address.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    ) {
      setError("Vui lòng nhập email hợp lệ (tối đa 254 ký tự).");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Mật khẩu phải có từ 12 đến 128 ký tự.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await register(name, address, password);
      router.replace(safeBuyerReturnTo(returnTo));
    } catch (cause) {
      setError(
        apiErrorMessage(
          cause,
          "Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Đăng ký</Text>
      <TextInput
        placeholder="Họ và tên"
        autoCapitalize="words"
        maxLength={120}
        value={fullName}
        onChangeText={setFullName}
      />
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
        title={busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        disabled={busy}
        onPress={() => void submit()}
      />
      <Button
        title="Đã có tài khoản? Đăng nhập"
        onPress={() =>
          router.replace({
            pathname: "/login",
            params: { returnTo: safeBuyerReturnTo(returnTo) },
          })
        }
      />
    </View>
  );
}
