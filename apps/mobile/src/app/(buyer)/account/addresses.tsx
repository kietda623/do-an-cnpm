import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ApiPath, components } from "@marketplace/api-client";
import { ApiClientError } from "@marketplace/api-client";
import { apiErrorMessage } from "../../../features/api/error-message";
import { useSession } from "../../../features/auth/session-provider";

type Address = components["schemas"]["Address"];
type AddressWrite = components["schemas"]["AddressWrite"];
type AddressPatch = components["schemas"]["AddressPatch"];

const emptyAddress: AddressWrite = {
  recipientName: "",
  phone: "",
  line1: "",
  ward: "",
  district: "",
  province: "",
  country: "VN",
  isDefault: false,
};

function addressItemPath(id: string): ApiPath {
  return ("/users/me/addresses/" + encodeURIComponent(id)) as ApiPath;
}

export default function AddressesRoute() {
  const { api } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [draft, setDraft] = useState<AddressWrite>(emptyAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAddresses(await api.request<Address[]>("/users/me/addresses"));
    } catch (cause) {
      setError(
        cause instanceof ApiClientError && cause.status === 403
          ? "Bạn không có quyền xem địa chỉ."
          : apiErrorMessage(cause, "Không thể tải địa chỉ."),
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  function startCreate() {
    setDraft(emptyAddress);
    setEditingId(null);
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function startEdit(address: Address) {
    setDraft({
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      ward: address.ward,
      district: address.district,
      province: address.province,
      country: address.country,
      isDefault: address.isDefault,
    });
    setEditingId(address.id);
    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function saveAddress() {
    const payload: AddressWrite = {
      recipientName: draft.recipientName.trim(),
      phone: draft.phone.trim(),
      line1: draft.line1.trim(),
      ward: draft.ward.trim(),
      district: draft.district.trim(),
      province: draft.province.trim(),
      country: "VN",
      isDefault: draft.isDefault,
    };
    if (
      payload.recipientName.length < 1 ||
      payload.recipientName.length > 120 ||
      payload.phone.length < 8 ||
      payload.phone.length > 20 ||
      payload.line1.length < 1 ||
      payload.line1.length > 250 ||
      payload.ward.length < 1 ||
      payload.ward.length > 120 ||
      payload.district.length < 1 ||
      payload.district.length > 120 ||
      payload.province.length < 1 ||
      payload.province.length > 120
    ) {
      setError("Vui lòng kiểm tra độ dài các trường địa chỉ theo yêu cầu.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = editingId
        ? await api.request<Address>(addressItemPath(editingId), {
            method: "PATCH",
            body: JSON.stringify(payload satisfies AddressPatch),
          })
        : await api.request<Address>("/users/me/addresses", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setAddresses((current) => {
        const next = editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
        return next.map((item) =>
          item.id !== saved.id && saved.isDefault
            ? { ...item, isDefault: false }
            : item,
        );
      });
      setShowForm(false);
      setEditingId(null);
      setNotice("Đã lưu địa chỉ.");
    } catch (cause) {
      setError(
        apiErrorMessage(cause, "Không thể lưu địa chỉ. Vui lòng thử lại."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.request<Address>(addressItemPath(id), {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true } satisfies AddressPatch),
      });
      setAddresses((current) =>
        current.map((address) =>
          address.id === id ? updated : { ...address, isDefault: false },
        ),
      );
      setNotice("Đã cập nhật địa chỉ mặc định.");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể cập nhật địa chỉ mặc định."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.request<void>(addressItemPath(id), { method: "DELETE" });
      setAddresses((current) => current.filter((address) => address.id !== id));
      setNotice("Đã xóa địa chỉ.");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Không thể xóa địa chỉ."));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(address: Address) {
    Alert.alert("Xóa địa chỉ", "Bạn có chắc muốn xóa địa chỉ này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => void deleteAddress(address.id),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">Địa chỉ</Text>
      {loading ? <Text>Đang tải địa chỉ…</Text> : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      {!loading && error ? (
        <Button title="Thử lại" onPress={() => void loadAddresses()} />
      ) : null}
      {!loading && !error && addresses.length === 0 && !showForm ? (
        <Text>Chưa có địa chỉ.</Text>
      ) : null}
      {!loading && !error ? (
        <Button title="Thêm địa chỉ" onPress={startCreate} />
      ) : null}
      {addresses.map((address) => (
        <View key={address.id} style={{ gap: 4, paddingVertical: 8 }}>
          <Text>{address.recipientName}</Text>
          <Text>{address.phone}</Text>
          <Text>
            {address.line1}, {address.ward}, {address.district},{" "}
            {address.province}
          </Text>
          {address.isDefault ? <Text>Địa chỉ mặc định</Text> : null}
          <Button
            title={"Sửa " + address.recipientName}
            disabled={busy}
            onPress={() => startEdit(address)}
          />
          {!address.isDefault ? (
            <Button
              title={"Đặt mặc định cho " + address.recipientName}
              disabled={busy}
              onPress={() => void setDefault(address.id)}
            />
          ) : null}
          <Button
            title={"Xóa " + address.recipientName}
            disabled={busy}
            onPress={() => confirmDelete(address)}
          />
        </View>
      ))}
      {showForm ? (
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header">
            {editingId ? "Sửa địa chỉ" : "Thêm địa chỉ"}
          </Text>
          <TextInput
            placeholder="Người nhận"
            maxLength={120}
            value={draft.recipientName}
            onChangeText={(recipientName) =>
              setDraft({ ...draft, recipientName })
            }
          />
          <TextInput
            placeholder="Điện thoại"
            keyboardType="phone-pad"
            maxLength={20}
            value={draft.phone}
            onChangeText={(phone) => setDraft({ ...draft, phone })}
          />
          <TextInput
            placeholder="Địa chỉ"
            maxLength={250}
            value={draft.line1}
            onChangeText={(line1) => setDraft({ ...draft, line1 })}
          />
          <TextInput
            placeholder="Phường"
            maxLength={120}
            value={draft.ward}
            onChangeText={(ward) => setDraft({ ...draft, ward })}
          />
          <TextInput
            placeholder="Quận"
            maxLength={120}
            value={draft.district}
            onChangeText={(district) => setDraft({ ...draft, district })}
          />
          <TextInput
            placeholder="Tỉnh / thành phố"
            maxLength={120}
            value={draft.province}
            onChangeText={(province) => setDraft({ ...draft, province })}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Switch
              value={draft.isDefault}
              onValueChange={(isDefault) => setDraft({ ...draft, isDefault })}
            />
            <Text>Địa chỉ mặc định</Text>
          </View>
          <Button
            title="Lưu địa chỉ"
            disabled={busy}
            onPress={() => void saveAddress()}
          />
          <Button
            title="Hủy"
            disabled={busy}
            onPress={() => setShowForm(false)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
