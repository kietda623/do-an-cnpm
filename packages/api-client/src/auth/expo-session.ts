import { ApiClientError, ApiTransport } from "../transport.ts";
import type { components } from "../generated/index.ts";
import type { TokenSet, TokenStore } from "./types.ts";
import { SessionRestore } from "./session-restore.ts";

type SecureStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
type Options = {
  baseUrl: string;
  clientPlatform: "ANDROID" | "IOS";
  secureStore: SecureStore;
  fetcher?: typeof fetch;
  onSessionInvalid?: () => void;
  onRefreshError?: (code: string) => void;
};
type Tokens = components["schemas"]["Tokens"];
const key = "marketplace.refresh.v1";

export class ExpoSession {
  readonly api: ApiTransport;
  private accessToken = "";
  private generation = 0;
  private invalidated = false;
  private storageQueue: Promise<void> = Promise.resolve();
  private readonly tokens: TokenStore;
  private readonly restoration = new SessionRestore();
  private readonly options: Options;

  constructor(options: Options) {
    this.options = options;
    this.tokens = {
      read: async () => {
        const refreshToken = await options.secureStore.getItemAsync(key);
        return this.accessToken || refreshToken
          ? {
              accessToken: this.accessToken,
              ...(refreshToken ? { refreshToken } : {}),
            }
          : null;
      },
      write: async (tokens: TokenSet) => {
        const generation = this.generation;
        await this.enqueueStorage(async () => {
          if (this.invalidated || generation !== this.generation) return;
          if (tokens.refreshToken)
            await options.secureStore.setItemAsync(key, tokens.refreshToken);
          if (!this.invalidated && generation === this.generation)
            this.accessToken = tokens.accessToken;
        });
      },
      clear: async () => {
        this.generation++;
        this.invalidated = true;
        this.accessToken = "";
        try {
          await this.enqueueStorage(() =>
            options.secureStore.deleteItemAsync(key),
          );
        } finally {
          options.onSessionInvalid?.();
        }
      },
    };
    const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    const guardedFetch: typeof fetch = async (input, init) => {
      const generation = this.generation;
      const response = await fetcher(input, { ...init, credentials: "omit" });
      if (generation !== this.generation)
        throw new Error("Session changed while request was in flight");
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh") && !response.ok) {
        try {
          const payload = (await response.clone().json()) as {
            error?: { code?: unknown };
          };
          const code = payload.error?.code;
          if (
            typeof code === "string" &&
            [
              "SESSION_REVOKED",
              "REFRESH_REUSE",
              "INVALID_REFRESH",
              "UNAUTHORIZED",
            ].includes(code)
          )
            options.onRefreshError?.(code);
        } catch {
          /* Ignore malformed error bodies; never log response content. */
        }
      }
      if (
        (path.endsWith("/auth/refresh") &&
          !response.ok &&
          response.status !== 401) ||
        (path.endsWith("/auth/login") && !response.ok)
      ) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }
        throw new ApiClientError("Request failed", response.status, payload);
      }
      return response;
    };
    this.api = new ApiTransport({
      baseUrl: options.baseUrl,
      clientPlatform: options.clientPlatform,
      refreshMode: "body",
      tokens: this.tokens,
      fetcher: guardedFetch,
    });
  }

  async login(email: string, password: string): Promise<Tokens["user"]> {
    const generation = this.generation;
    const result = await this.api.request<Tokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        clientPlatform: this.options.clientPlatform,
      }),
    });
    if (!result.refreshToken)
      throw new Error("Native login did not return a refresh token");
    if (generation !== this.generation)
      throw new Error("Session changed during login");
    this.invalidated = false;
    await this.tokens.write({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    if (generation !== this.generation)
      throw new Error("Session changed during login");
    return result.user;
  }

  restore(): Promise<Tokens["user"] | null> {
    return this.restoration.run(async () => {
      const generation = this.generation;
      const current = await this.tokens.read();
      if (!current?.refreshToken) return null;
      try {
        const result = await this.api.request<Tokens>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({
            clientPlatform: this.options.clientPlatform,
            refreshToken: current.refreshToken,
          }),
        });
        if (!result.refreshToken)
          throw new Error("Native refresh did not rotate its token");
        await this.tokens.write({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        if (generation !== this.generation)
          throw new Error("Session changed during restoration");
        return result.user;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          try {
            await this.tokens.clear();
          } catch {
            // Preserve the HTTP status so the provider still leaves restore mode.
          }
        }
        throw error;
      }
    });
  }

  async logout(): Promise<void> {
    const send = async () => {
      const current = await this.tokens.read();
      await this.api.request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({
          clientPlatform: this.options.clientPlatform,
          refreshToken: current?.refreshToken,
        }),
      });
    };
    try {
      try {
        await send();
      } catch (error) {
        if (
          this.invalidated ||
          !(error instanceof ApiClientError) ||
          error.status !== 401
        )
          throw error;
        await send();
      }
    } finally {
      if (!this.invalidated) await this.tokens.clear();
    }
  }

  private enqueueStorage(operation: () => Promise<void>): Promise<void> {
    const next = this.storageQueue.then(operation, operation);
    this.storageQueue = next.catch(() => {});
    return next;
  }
}
