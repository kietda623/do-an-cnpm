import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Button, Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import {
  ExpoSession,
  SessionChangedError,
  SessionStorageError,
} from "@marketplace/api-client/auth/expo-session";
import { ApiClientError } from "@marketplace/api-client";
import type { components } from "@marketplace/api-client";
import { safeBuyerReturnTo } from "../../navigation/return-to";

type User = components["schemas"]["User"];
export const RESUME_BACKGROUND_THRESHOLD_MS = 30_000;
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
  const [resumeError, setResumeError] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userRef = useRef(user);
  userRef.current = user;
  const clearCachedData = useCallback(async () => {
    await queryClient.cancelQueries().catch(() => undefined);
    queryClient.clear();
  }, [queryClient]);
  const invalidateSession = useCallback(async () => {
    await clearCachedData();
    setUser(null);
    setResumeError(false);
    setNeedsLogin(true);
  }, [clearCachedData]);
  const session = useMemo(
    () =>
      new ExpoSession({
        baseUrl: String(Constants.expoConfig?.extra?.apiBaseUrl ?? ""),
        clientPlatform: Platform.OS === "ios" ? "IOS" : "ANDROID",
        secureStore: SecureStore,
        onSessionInvalid: invalidateSession,
        onRefreshError: (code) => {
          console.warn(`Refresh failed: ${code}`);
        },
      }),
    [invalidateSession],
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
  const resume = useCallback(async () => {
    const generation = session.generationId;
    setResumeError(false);
    try {
      const currentUser = await session.resume();
      if (generation === session.generationId) setUser(currentUser);
    } catch (error) {
      if (
        generation === session.generationId &&
        !(error instanceof SessionChangedError)
      )
        setResumeError(true);
    }
  }, [session]);
  useEffect(() => {
    let backgroundedAt: number | null = null;
    let foreground = AppState.currentState === "active";
    let resumeInFlight = false;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        foreground = false;
        backgroundedAt ??= Date.now();
        focusManager.setFocused(false);
        return;
      }

      foreground = true;
      if (resumeInFlight) return;
      const backgroundDuration =
        backgroundedAt === null ? 0 : Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (
        backgroundDuration < RESUME_BACKGROUND_THRESHOLD_MS ||
        !userRef.current
      ) {
        focusManager.setFocused(true);
        return;
      }

      resumeInFlight = true;
      focusManager.setFocused(false);
      const generation = session.generationId;
      void resume().finally(() => {
        resumeInFlight = false;
        if (
          foreground &&
          userRef.current &&
          generation === session.generationId
        )
          focusManager.setFocused(true);
      });
    });
    return () => subscription.remove();
  }, [resume, session]);
  useEffect(() => {
    if (state === "ready" && needsLogin) {
      setNeedsLogin(false);
      router.replace({
        pathname: "/login",
        params: { returnTo: safeBuyerReturnTo(pathname) },
      });
    }
  }, [state, needsLogin, pathname, router]);
  const value = useMemo<ContextValue>(
    () => ({
      api: session.api,
      user,
      login: async (email, password) => {
        const nextUser = await session.login(email, password);
        await clearCachedData();
        setUser(nextUser);
        setResumeError(false);
        focusManager.setFocused(true);
      },
      logout: async () => {
        await session.logout();
      },
    }),
    [clearCachedData, session, user],
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
  return (
    <Context.Provider value={value}>
      {children}
      {resumeError ? (
        <View style={{ padding: 8 }}>
          <Text accessibilityRole="alert">
            Không thể kiểm tra phiên. Vui lòng thử lại.
          </Text>
          <Button title="Thử lại" onPress={() => void resume()} />
        </View>
      ) : null}
    </Context.Provider>
  );
}
