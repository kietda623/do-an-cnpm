import React from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import type { ApiResourceState } from "./use-api-resource";

type Props = {
  state: ApiResourceState<unknown>;
  emptyMessage: string;
  onRetry: () => void;
};

export function ApiResourceFeedback({ state, emptyMessage, onRetry }: Props) {
  if (state.status === "loading")
    return <ActivityIndicator accessibilityLabel="Đang tải dữ liệu" />;
  if (state.status === "empty") return <Text>{emptyMessage}</Text>;
  if (state.status === "forbidden")
    return (
      <Text accessibilityRole="alert">
        Bạn không có quyền xem nội dung này.
      </Text>
    );
  if (state.status === "error")
    return (
      <View>
        <Text accessibilityRole="alert">Không thể tải dữ liệu.</Text>
        <Button title="Thử lại" onPress={onRetry} />
      </View>
    );
  return null;
}
