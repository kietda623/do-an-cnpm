"use client";

import {
  ApiClientError,
  ApiConnectionError,
  normalizeFormError,
  type WebSession,
} from "@marketplace/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession, type SessionUser } from "../auth/session-provider";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface ApiContextValue {
  session: WebSession;
  api: WebSession["api"];
  user: SessionUser | null;
  status: AuthStatus;
  restoreError: string | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SessionUser | null>;
  clear: () => Promise<void>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({
  session,
  children,
}: {
  session: WebSession;
  children: ReactNode;
}) {
  const { user, setUser } = useSession();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const started = useRef(false);

  const restore = useCallback(async () => {
    setRestoreError(null);
    try {
      const restored = await session.restore<SessionUser>();
      setUser(restored);
      setStatus("authenticated");
      setRestoreError(null);
    } catch (error) {
      if (
        error instanceof ApiConnectionError ||
        (error instanceof ApiClientError &&
          (error.status >= 500 || error.status === 429))
      ) {
        setRestoreError(normalizeFormError(error));
        return;
      }
      setUser(null);
      setStatus("anonymous");
    }
  }, [session, setUser]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void restore();
  }, [restore]);

  const login = useCallback(
    async (email: string, password: string) => {
      const nextUser = await session.login<SessionUser>(email, password);
      setUser(nextUser);
      setStatus("authenticated");
      setRestoreError(null);
      return nextUser;
    },
    [session, setUser],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const nextUser = await session.register<SessionUser>(
        fullName,
        email,
        password,
      );
      setUser(nextUser);
      setStatus("authenticated");
      setRestoreError(null);
      return nextUser;
    },
    [session, setUser],
  );

  const logout = useCallback(async () => {
    try {
      await session.logout();
    } catch {
      await session.clear();
    }
    setUser(null);
    setStatus("anonymous");
  }, [session, setUser]);

  const refreshUser = useCallback(async () => {
    try {
      const nextUser = await session.currentUser<SessionUser>();
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.status !== 401)
        throw error;
      await session.clear();
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, [session, setUser]);

  const clear = useCallback(async () => {
    await session.clear();
    setUser(null);
    setStatus("anonymous");
  }, [session, setUser]);

  const value = useMemo<ApiContextValue>(
    () => ({
      session,
      api: session.api,
      user,
      status,
      restoreError,
      login,
      register,
      logout,
      refreshUser,
      clear,
    }),
    [
      session,
      user,
      status,
      restoreError,
      login,
      register,
      logout,
      refreshUser,
      clear,
    ],
  );

  return (
    <ApiContext.Provider value={value}>
      {status === "loading" && restoreError && (
        <div className="mp-alert-inline" role="alert">
          {restoreError}{" "}
          <button
            className="mp-link"
            type="button"
            onClick={() => void restore()}
          >
            Thử lại khôi phục phiên
          </button>
        </div>
      )}
      {children}
    </ApiContext.Provider>
  );
}

export function useApi(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error("useApi must be used inside ApiProvider");
  return value;
}
