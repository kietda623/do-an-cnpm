import { ApiClientError, ApiTransport, type ApiPath } from "../transport.ts";
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
  onSessionInvalid?: () => void | Promise<void>;
  onRefreshError?: (code: string) => void;
};
type Tokens = components["schemas"]["Tokens"];
const key = "marketplace.refresh.v1";

export class SessionStorageError extends Error {
  constructor() {
    super("Session could not be stored securely. Sign in again.");
    this.name = "SessionStorageError";
  }
}

export class SessionChangedError extends Error {
  constructor() {
    super("Session changed while the request was in flight.");
    this.name = "SessionChangedError";
  }
}

export class ExpoSession {
  readonly api: Pick<ApiTransport, "request">;
  private accessToken = "";
  private generation = 0;
  private invalidated = false;
  private invalidation: Promise<void> | undefined;
  private storageQueue: Promise<void> = Promise.resolve();
  private readonly tokens: TokenStore;
  private readonly restoration = new SessionRestore();
  private readonly options: Options;
  private readonly transport: ApiTransport;

  constructor(options: Options) {
    this.options = options;
    this.tokens = {
      read: async () => {
        if (this.invalidated) return null;
        const refreshToken = await options.secureStore.getItemAsync(key);
        if (this.invalidated) return null;
        return this.accessToken || refreshToken
          ? {
              accessToken: this.accessToken,
              ...(refreshToken ? { refreshToken } : {}),
            }
          : null;
      },
      write: async (tokens: TokenSet) => {
        const generation = this.generation;
        try {
          await this.enqueueStorage(async () => {
            if (this.invalidated || generation !== this.generation) return;
            if (tokens.refreshToken)
              await options.secureStore.setItemAsync(key, tokens.refreshToken);
            if (!this.invalidated && generation === this.generation)
              this.accessToken = tokens.accessToken;
          });
        } catch {
          // Run cleanup outside the storage queue to avoid waiting on itself.
          if (!this.invalidated && generation === this.generation) {
            try {
              await this.tokens.clear();
            } catch {
              // UI and memory are invalidated even if physical deletion fails.
            }
          }
          throw new SessionStorageError();
        }
      },
      clear: async () => {
        if (this.invalidation) return this.invalidation;
        this.generation++;
        this.invalidated = true;
        this.accessToken = "";
        this.invalidation = (async () => {
          try {
            await this.enqueueStorage(() =>
              options.secureStore.deleteItemAsync(key),
            );
          } finally {
            await options.onSessionInvalid?.();
          }
        })();
        return this.invalidation;
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
    this.transport = new ApiTransport({
      baseUrl: options.baseUrl,
      clientPlatform: options.clientPlatform,
      refreshMode: "body",
      tokens: this.tokens,
      fetcher: guardedFetch,
    });
    this.api = {
      request: <T>(path: ApiPath, init?: RequestInit) =>
        this.requestForCurrentGeneration<T>(path, init),
    };
  }

  get generationId(): number {
    return this.generation;
  }

  private async requestForCurrentGeneration<T>(
    path: ApiPath,
    init?: RequestInit,
  ): Promise<T> {
    const generation = this.generation;
    try {
      const result = await this.transport.request<T>(path, init);
      if (generation !== this.generation) throw new SessionChangedError();
      return result;
    } catch (error) {
      if (generation !== this.generation) {
        if (error instanceof SessionStorageError) throw error;
        throw new SessionChangedError();
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<Tokens["user"]> {
    const generation = this.generation;
    const result = await this.transport.request<Tokens>("/auth/login", {
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
    this.generation++;
    const writeGeneration = this.generation;
    this.invalidated = false;
    this.invalidation = undefined;
    await this.tokens.write({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    if (writeGeneration !== this.generation)
      throw new Error("Session changed during login");
    return result.user;
  }

  restore(): Promise<Tokens["user"] | null> {
    return this.restoration.run(async () => {
      const generation = this.generation;
      const current = await this.tokens.read();
      if (!current?.refreshToken) return null;
      try {
        const result = await this.transport.request<Tokens>("/auth/refresh", {
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

  async resume(): Promise<Tokens["user"]> {
    try {
      return await this.api.request<Tokens["user"]>("/users/me");
    } catch (error) {
      const code =
        error instanceof ApiClientError &&
        typeof error.payload === "object" &&
        error.payload !== null &&
        "error" in error.payload &&
        typeof error.payload.error === "object" &&
        error.payload.error !== null &&
        "code" in error.payload.error
          ? error.payload.error.code
          : undefined;
      if (
        !this.invalidated &&
        ((error instanceof ApiClientError && error.status === 401) ||
          (error instanceof ApiClientError &&
            error.status === 403 &&
            code === "ACCOUNT_LOCKED"))
      ) {
        try {
          await this.tokens.clear();
        } catch {
          // Local memory/UI invalidation still runs when SecureStore deletion fails.
        }
      }
      throw error;
    }
  }

  async logout(): Promise<void> {
    const send = async () => {
      const current = await this.tokens.read();
      await this.transport.request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({
          clientPlatform: this.options.clientPlatform,
          refreshToken: current?.refreshToken,
        }),
      });
    };
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
    if (!this.invalidated) await this.tokens.clear();
  }

  private enqueueStorage(operation: () => Promise<void>): Promise<void> {
    const next = this.storageQueue.then(operation, operation);
    this.storageQueue = next.catch(() => {});
    return next;
  }
}
