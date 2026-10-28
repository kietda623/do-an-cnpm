import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button, Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ExpoSession,
  SessionStorageError,
} from "@marketplace/api-client/auth/expo-session";
import { ApiClientError } from "@marketplace/api-client";
import type { components } from "@marketplace/api-client";

type User = components["schemas"]["User"];
type ContextValue = {
  api: ExpoSession["api"];
  user: User | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const recoveryStyle = {
    flex: 1,
    paddingTop: insets.top + 20,
    paddingBottom: insets.bottom + 20,
    paddingLeft: insets.left + 20,
    paddingRight: insets.right + 20,
  };
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "retry">("loading");
  const [needsLogin, setNeedsLogin] = useState(false);
  const router = useRouter();
  const session = useMemo(
    () =>
      new ExpoSession({
        baseUrl: String(Constants.expoConfig?.extra?.apiBaseUrl ?? ""),
        clientPlatform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        secureStore: SecureStore,
        onSessionInvalid: () => {
          setUser(null);
          setNeedsLogin(true);
        },
        onRefreshError: (code) => {
          console.warn(`Refresh failed: ${code}`);
        },
      }),
    [],
  );
  const restore = useCallback(async () => {
    setState("loading");
    try {
      setUser(await session.restore());
      setState("ready");
    } catch (error) {
      setState(
        error instanceof SessionStorageError ||
          (error instanceof ApiClientError && error.status === 401)
          ? "ready"
          : "retry",
      );
    }
  }, [session]);
  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(() => {
    if (state === "ready" && needsLogin) {
      setNeedsLogin(false);
      router.replace("/login");
    }
  }, [state, needsLogin, router]);
  const value = useMemo<ContextValue>(
    () => ({
      api: session.api,
      user,
      login: async (email, password) => {
        setUser(await session.login(email, password));
      },
      logout: async () => {
        await session.logout();
      },
    }),
    [session, user],
  );
  if (state === "loading")
    return (
      <View style={recoveryStyle}>
        <Text>Đang khôi phục phiên…</Text>
      </View>
    );
  if (state === "retry")
    return (
      <View style={recoveryStyle}>
        <Text>Không thể khôi phục phiên. Kiểm tra kết nối rồi thử lại.</Text>
        <Button title="Thử lại" onPress={() => void restore()} />
      </View>
    );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
