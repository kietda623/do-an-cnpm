import { ApiTransport, type ApiTransportOptions } from "../transport";
import { MemoryTokenStore } from "./types";
import { SessionRestore } from "./session-restore";

const tokenStore = new MemoryTokenStore();

export class WebSession {
  readonly api: ApiTransport;
  private readonly restoration = new SessionRestore();
  constructor(baseUrl: string, fetcher?: typeof fetch) {
    const options: ApiTransportOptions = {
      baseUrl,
      clientPlatform: "WEB",
      refreshMode: "cookie",
      tokens: tokenStore,
      ...(fetcher ? { fetcher } : {}),
    };
    this.api = new ApiTransport(options);
  }
  async currentUser<T>(): Promise<T> {
    return this.api.request<T>("/users/me");
  }
  restore<T>(): Promise<T> {
    return this.restoration.run(async () => {
      const result = await this.api.request<{ accessToken: string }>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ clientPlatform: "WEB" }),
        },
      );
      await this.api.setTokens({ accessToken: result.accessToken });
      return this.currentUser<T>();
    });
  }
  async login<T>(email: string, password: string): Promise<T> {
    const result = await this.api.request<{
      accessToken: string;
      refreshToken?: string | null;
      user?: T;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, clientPlatform: "WEB" }),
    });
    await this.api.setTokens({ accessToken: result.accessToken });
    return result.user ?? (await this.currentUser<T>());
  }
  async register<T>(
    fullName: string,
    email: string,
    password: string,
  ): Promise<T> {
    const result = await this.api.request<{
      accessToken: string;
      refreshToken?: string | null;
      user?: T;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        password,
        clientPlatform: "WEB",
      }),
    });
    await this.api.setTokens({ accessToken: result.accessToken });
    return result.user ?? (await this.currentUser<T>());
  }
  async logout(): Promise<void> {
    try {
      await this.api.request("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ clientPlatform: "WEB" }),
      });
    } finally {
      await tokenStore.clear();
    }
  }
  clear(): Promise<void> {
    return tokenStore.clear();
  }
}

export function normalizeFormError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
