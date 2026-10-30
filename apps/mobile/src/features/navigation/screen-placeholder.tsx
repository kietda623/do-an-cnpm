import React from "react";
import { Button, Text, View } from "react-native";
import { useRouter } from "expo-router";

type Props = { title: string; task: "T135" | "T136" | "T137" | "T138" };

export function ScreenPlaceholder({ title, task }: Props) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, padding: 20, gap: 12 }}>
      <Text accessibilityRole="header">{title}</Text>
      <Text>
        {title} đang phát triển ({task}).
      </Text>
      <Button title="Trang chủ" onPress={() => router.replace("/")} />
    </View>
  );
}
