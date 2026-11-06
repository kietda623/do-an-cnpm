import type { components, paths } from "./generated/index.ts";
import type { TokenSet, TokenStore } from "./auth/types.ts";

export type ApiPath = keyof paths;
export type ApiErrorEnvelope = components["schemas"]["ErrorEnvelope"];
export type ClientPlatform = "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";
type ApiEnvelope<T> = { data: T; meta?: components["schemas"]["PageMeta"] };
type RefreshResponse = components["schemas"]["Tokens"];
const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

export function resolveApiBaseUrl(
  baseUrl: string,
  browserHostname?: string,
): string {
  const url = new URL(baseUrl.trim());
  if (
    browserHostname &&
    loopbackHosts.has(browserHostname) &&
    loopbackHosts.has(url.hostname)
  )
    url.hostname = browserHostname;
  url.pathname = url.pathname.replace(/\/+$/, "") || "/api/v1";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export class ApiConnectionError extends Error {
  constructor(cause: unknown) {
    super(
      "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại.",
      { cause },
    );
    this.name = "ApiConnectionError";
  }
}

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
  private csrfInFlight: Promise<string> | undefined;

  private readonly options: ApiTransportOptions;

  constructor(options: ApiTransportOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(path: ApiPath, init: RequestInit = {}): Promise<T> {
    return (await this.requestEnvelope<T>(path, init)).data;
  }

  async requestEnvelope<T>(
    path: ApiPath,
    init: RequestInit = {},
  ): Promise<ApiEnvelope<T>> {
    const method = (init.method ?? "GET").toUpperCase();
    const generation = this.options.tokens.getGeneration?.();
    const first = await this.send(path, init);
    if (
      first.status !== 401 ||
      path === "/auth/refresh" ||
      path === "/auth/login" ||
      path === "/auth/register"
    )
      return this.readEnvelope<T>(first);

    await this.refreshAccessToken(generation);
    if (!readMethods.has(method)) {
      return this.readEnvelope<T>(first);
    }

    return this.readEnvelope<T>(await this.send(path, init));
  }

  async setTokens(tokens: TokenSet): Promise<void> {
    await this.options.tokens.write(tokens);
  }

  private async send(
    path: ApiPath,
    init: RequestInit,
    retryCsrf = true,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    const method = (init.method ?? "GET").toUpperCase();
    if (!readMethods.has(method) && this.options.clientPlatform === "WEB") {
      headers.set("X-CSRF-Token", await this.getCsrfToken());
    }
    const tokens = await this.options.tokens.read();
    if (tokens?.accessToken)
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    if (
      init.body !== undefined &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchResponse(path, {
      ...init,
      headers,
      credentials: "include",
    });
    const csrfToken = headers.get("X-CSRF-Token");
    if (
      retryCsrf &&
      this.options.clientPlatform === "WEB" &&
      csrfToken &&
      response.status === 403 &&
      !(init.body instanceof ReadableStream)
    ) {
      const error = await this.toError(response.clone());
      if (
        (error.payload as ApiErrorEnvelope | undefined)?.error?.code ===
        "CSRF_REJECTED"
      ) {
        if (this.csrfToken === csrfToken) this.csrfToken = undefined;
        return this.send(path, init, false);
      }
    }
    return response;
  }

  private refreshAccessToken(expectedGeneration?: number): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh(expectedGeneration).finally(
        () => {
          this.refreshInFlight = undefined;
        },
      );
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

    const response = await this.send("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) await this.options.tokens.clear();
      throw await this.toError(response);
    }

    const envelope = (await response.json()) as ApiEnvelope<RefreshResponse>;
    const result: TokenSet = { accessToken: envelope.data.accessToken };
    if (envelope.data.refreshToken)
      result.refreshToken = envelope.data.refreshToken;
    await this.options.tokens.write(result, expectedGeneration);
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    this.csrfInFlight ??= this.loadCsrfToken().finally(() => {
      this.csrfInFlight = undefined;
    });
    return this.csrfInFlight;
  }

  private async loadCsrfToken(): Promise<string> {
    const response = await this.fetchResponse("/auth/csrf", {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw await this.toError(response);
    const envelope = (await response.json()) as ApiEnvelope<{
      csrfToken: string;
    }>;
    this.csrfToken = envelope.data.csrfToken;
    return this.csrfToken;
  }

  private async readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
    if (!response.ok) throw await this.toError(response);
    if (response.status === 204) return { data: undefined as T };
    return (await response.json()) as ApiEnvelope<T>;
  }

  private buildUrl(path: string): URL {
    const baseUrl = resolveApiBaseUrl(
      this.baseUrl,
      this.options.clientPlatform === "WEB" && typeof window !== "undefined"
        ? window.location.hostname
        : undefined,
    );
    return new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);
  }

  private async fetchResponse(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const url = this.buildUrl(path);
    try {
      return await this.fetcher(url, init);
    } catch (error) {
      if (
        init.signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.name === "TimeoutError")
      )
        throw new ApiConnectionError(error);
      throw error;
    }
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
      envelope?.error?.message ??
        `API request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }
}
