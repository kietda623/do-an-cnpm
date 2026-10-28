import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../features/auth/session-provider";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
