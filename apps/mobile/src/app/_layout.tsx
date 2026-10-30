import React from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../features/auth/session-provider";
import { mobileQueryClient } from "../features/api/query-client";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={mobileQueryClient}>
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(public)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(buyer)" />
          </Stack>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
