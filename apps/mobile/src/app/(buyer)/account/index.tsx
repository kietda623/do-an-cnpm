import React, { useEffect, useState } from "react";
import { Button, Image, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { components } from "@marketplace/api-client";
import { apiErrorMessage } from "../../../features/api/error-message";
import { useSession } from "../../../features/auth/session-provider";

type User = components["schemas"]["User"];
type ProfilePatch = components["schemas"]["ProfilePatch"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ProfileRoute() {
  const { api, user, updateUser } = useSession();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
  }, [user?.id, user?.fullName, user?.phone]);

  async function saveProfile() {
    const name = fullName.trim();
    const normalizedPhone = phone.trim();
    if (name.length < 1 || name.length > 120) {
      setError("Họ và tên phải có từ 1 đến 120 ký tự.");
      return;
    }
    if (
      normalizedPhone &&
      (normalizedPhone.length < 8 || normalizedPhone.length > 20)
    ) {
      setError("Số điện thoại phải có từ 8 đến 20 ký tự.");
      return;
    }
    const payload: ProfilePatch = {
      fullName: name,
      phone: normalizedPhone || null,
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      updateUser(updated);
      setNotice("Đã lưu hồ sơ.");
    } catch (cause) {
      setError(
        apiErrorMessage(cause, "Không thể lưu hồ sơ. Vui lòng thử lại."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (currentPassword.length < 1 || currentPassword.length > 128) {
      setError("Mật khẩu hiện tại phải có từ 1 đến 128 ký tự.");
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Mật khẩu mới phải có từ 12 đến 128 ký tự.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.request<void>("/users/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setShowPassword(false);
      setNotice("Đã đổi mật khẩu.");
    } catch (cause) {
      setError(
        apiErrorMessage(cause, "Không thể đổi mật khẩu. Vui lòng thử lại."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function chooseAvatar() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Cần cho phép truy cập ảnh để chọn ảnh đại diện.");
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!AVATAR_MIME_TYPES.has(mimeType)) {
        setError("Ảnh đại diện chỉ hỗ trợ JPEG, PNG hoặc WebP.");
        return;
      }
      if (asset.fileSize !== undefined && asset.fileSize > MAX_AVATAR_BYTES) {
        setError("Ảnh đại diện phải nhỏ hơn hoặc bằng 5 MB.");
        return;
      }
      const body = new FormData();
      body.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: mimeType,
      } as unknown as Blob);
      body.append("purpose", "AVATAR");
      const uploaded = await api.request<components["schemas"]["Asset"]>(
        "/users/me/assets",
        { method: "POST", body },
      );
      const updated = await api.request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          avatarAssetId: uploaded.id,
        } satisfies ProfilePatch),
      });
      updateUser(updated);
      setNotice("Đã cập nhật ảnh đại diện.");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể cập nhật ảnh đại diện."));
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return (
      <View style={{ padding: 20 }}>
        <Text>Đang tải hồ sơ…</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Hồ sơ</Text>
      <Text>{user.email}</Text>
      <TextInput
        placeholder="Họ và tên"
        maxLength={120}
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        placeholder="Số điện thoại"
        keyboardType="phone-pad"
        maxLength={20}
        value={phone}
        onChangeText={setPhone}
      />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      <Button
        title={busy ? "Đang lưu…" : "Lưu hồ sơ"}
        disabled={busy}
        onPress={() => void saveProfile()}
      />
      {user.avatar && typeof user.avatar === "object" ? (
        <Image
          accessibilityLabel="Ảnh đại diện"
          source={{ uri: user.avatar.url }}
          style={{ width: 80, height: 80, borderRadius: 40 }}
        />
      ) : null}
      <Button
        title="Chọn ảnh đại diện"
        disabled={busy}
        onPress={() => void chooseAvatar()}
      />
      {!showPassword ? (
        <Button
          title="Đổi mật khẩu"
          onPress={() => {
            setError("");
            setShowPassword(true);
          }}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="Mật khẩu hiện tại"
            secureTextEntry
            maxLength={128}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <TextInput
            placeholder="Mật khẩu mới"
            secureTextEntry
            maxLength={128}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Button
            title="Lưu mật khẩu"
            disabled={busy}
            onPress={() => void changePassword()}
          />
          <Button
            title="Hủy"
            onPress={() => {
              setShowPassword(false);
              setError("");
            }}
          />
        </View>
      )}
    </ScrollView>
  );
}
