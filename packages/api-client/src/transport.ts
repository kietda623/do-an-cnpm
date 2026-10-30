import type { components, paths } from "./generated/index.ts";
import type { TokenSet, TokenStore } from "./auth/types.ts";

export type ApiPath = keyof paths;
export type ApiErrorEnvelope = components["schemas"]["ErrorEnvelope"];
export type ClientPlatform = "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
type ApiEnvelope<T> = { data: T; meta?: unknown };
type RefreshResponse = components["schemas"]["Tokens"];

export interface ApiTransportOptions {
  baseUrl: string;
  clientPlatform: ClientPlatform;
  tokens: TokenStore;
  refreshMode?: "cookie" | "body";
  fetcher?: typeof fetch;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

export class ApiTransport {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private refreshInFlight: Promise<void> | undefined;
  private csrfToken: string | undefined;

  private readonly options: ApiTransportOptions;

  constructor(options: ApiTransportOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(path: ApiPath, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const generation = this.options.tokens.getGeneration?.();
    const first = await this.send(path, init);
    if (first.status !== 401 || path === "/auth/refresh") return this.readResponse<T>(first);

    await this.refreshAccessToken(generation);
    if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method)) {
      return this.readResponse<T>(first);
    }

    return this.readResponse<T>(await this.send(path, init));
  }

  async setTokens(tokens: TokenSet): Promise<void> {
    await this.options.tokens.write(tokens);
  }

  private async send(path: ApiPath, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    const method = (init.method ?? "GET").toUpperCase();
    if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method) && this.options.clientPlatform === "WEB") {
      headers.set("X-CSRF-Token", await this.getCsrfToken());
    }
    const tokens = await this.options.tokens.read();
    if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    if (
      init.body !== undefined &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    return this.fetcher(this.buildUrl(path), {
      ...init,
      headers,
      credentials: "include",
    });
  }

  private refreshAccessToken(expectedGeneration?: number): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh(expectedGeneration).finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(expectedGeneration?: number): Promise<void> {
    if (
      expectedGeneration !== undefined &&
      this.options.tokens.getGeneration?.() !== expectedGeneration
    )
      throw new Error("Session changed before token refresh");
    const current = await this.options.tokens.read();
    if (
      expectedGeneration !== undefined &&
      this.options.tokens.getGeneration?.() !== expectedGeneration
    )
      throw new Error("Session changed before token refresh");
    const body: components["schemas"]["Refresh"] = {
      clientPlatform: this.options.clientPlatform,
      ...(this.options.refreshMode === "body" && current?.refreshToken
        ? { refreshToken: current.refreshToken }
        : {}),
    };

    const response = await this.fetcher(this.buildUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.clientPlatform === "WEB"
          ? { "X-CSRF-Token": await this.getCsrfToken() }
          : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.options.tokens.clear();
      throw await this.toError(response);
    }

    const envelope = (await response.json()) as ApiEnvelope<RefreshResponse>;
    const result: TokenSet = { accessToken: envelope.data.accessToken };
    if (envelope.data.refreshToken) result.refreshToken = envelope.data.refreshToken;
    await this.options.tokens.write(result, expectedGeneration);
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const response = await this.fetcher(this.buildUrl("/auth/csrf"), { credentials: "include" });
    if (!response.ok) throw await this.toError(response);
    const envelope = (await response.json()) as ApiEnvelope<{ csrfToken: string }>;
    this.csrfToken = envelope.data.csrfToken;
    return this.csrfToken;
  }

  private async readResponse<T>(response: Response): Promise<T> {
    if (!response.ok) throw await this.toError(response);
    if (response.status === 204) return undefined as T;
    const envelope = (await response.json()) as ApiEnvelope<T>;
    return envelope.data;
  }

  private buildUrl(path: string): URL {
    return new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);
  }

  private async toError(response: Response): Promise<ApiClientError> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    const envelope = payload as ApiErrorEnvelope | undefined;
    return new ApiClientError(
      envelope?.error?.message ?? `API request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }
}
