import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryTokenStore } from "../src/auth/types.ts";
import {
  ApiClientError,
  ApiTransport,
  resolveApiBaseUrl,
} from "../src/transport.ts";
import { SessionRestore } from "../src/auth/session-restore.ts";

const unauthorized = () =>
  Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Sign in again",
        requestId: "test",
      },
    },
    { status: 401 },
  );

describe("API transport auth behavior", () => {
  it("refreshes stale CSRF during session recovery and preserves access after a 503", async () => {
    const tokens = new MemoryTokenStore();
    await tokens.write({ accessToken: "existing" });
    let issues = 0;
    const attempts: Array<string | null> = [];
    const api = new ApiTransport({
      baseUrl: "https://api.example.test",
      clientPlatform: "WEB",
      tokens,
      fetcher: async (input, init) => {
        if (String(input).endsWith("/auth/csrf"))
          return Response.json({ data: { csrfToken: `csrf-${++issues}` } });
        if (!String(input).endsWith("/auth/refresh")) return unauthorized();
        attempts.push(new Headers(init?.headers).get("X-CSRF-Token"));
        return attempts.length === 1
          ? Response.json({ error: { code: "CSRF_REJECTED" } }, { status: 403 })
          : Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 503 });
      },
    });
    await assert.rejects(api.request("/users/me"), { status: 503 });
    assert.deepEqual(attempts, ["csrf-1", "csrf-2"]);
    assert.equal((await tokens.read())?.accessToken, "existing");
  });

  it("normalizes API roots and matches only local browser hostnames", () => {
    assert.equal(
      resolveApiBaseUrl("http://localhost:4000/", "127.0.0.1"),
      "http://127.0.0.1:4000/api/v1",
    );
    assert.equal(
      resolveApiBaseUrl("https://example.test/gateway/api/v1///", "localhost"),
      "https://example.test/gateway/api/v1",
    );
  });

  it("preserves a failed write for manual retry and shares concurrent CSRF acquisition", async () => {
    let csrfCalls = 0;
    let writes = 0;
    const api = new ApiTransport({
      baseUrl: "https://api.example.test",
      clientPlatform: "WEB",
      tokens: new MemoryTokenStore(),
      fetcher: async (input) => {
        if (String(input).endsWith("/auth/csrf")) {
          csrfCalls++;
          return Response.json({ data: { csrfToken: "shared" } });
        }
        writes++;
        throw new TypeError("Failed to fetch");
      },
    });
    const write = () =>
      api.request("/users/me", { method: "PATCH", body: "{}" });
    await Promise.all([
      assert.rejects(write(), /Không thể kết nối/),
      assert.rejects(write(), /Không thể kết nối/),
    ]);
    assert.equal(csrfCalls, 1);
    assert.equal(writes, 2);
  });
  it("retries a rejected browser write once with a fresh CSRF token", async () => {
    let issues = 0;
    const attempts: Array<{ token: string | null; body: unknown }> = [];
    const api = new ApiTransport({
      baseUrl: "https://api.example.test/api/v1",
      clientPlatform: "WEB",
      tokens: new MemoryTokenStore(),
      fetcher: async (input, init) => {
        if (String(input).endsWith("/auth/csrf")) {
          return Response.json({ data: { csrfToken: `token-${++issues}` } });
        }
        attempts.push({
          token: new Headers(init?.headers).get("X-CSRF-Token"),
          body: init?.body,
        });
        return Response.json(
          { error: { code: "CSRF_REJECTED", message: "Stale token" } },
          { status: 403 },
        );
      },
    });
    const body = JSON.stringify({ fullName: "Buyer", phone: null });
    await assert.rejects(
      api.request("/users/me", { method: "PATCH", body }),
      /Stale token/,
    );
    assert.deepEqual(attempts, [
      { token: "token-1", body },
      { token: "token-2", body },
    ]);
  });

  it("allows a fresh restore after a failed in-flight restoration", async () => {
    const session = new SessionRestore();
    const failed = () => Promise.reject(new Error("session expired"));
    await assert.rejects(session.run(failed), /session expired/);
    assert.deepEqual(
      await session.run(async () => ({ id: "signed-in-again" })),
      { id: "signed-in-again" },
    );
  });
  it("restores one browser session for concurrent mount effects", async () => {
    let refreshCalls = 0;
    const session = new SessionRestore();
    const restore = async () => {
      refreshCalls += 1;
      await new Promise((done) => setTimeout(done, 10));
      return { id: "buyer" };
    };
    const users = await Promise.all([
      session.run(restore),
      session.run(restore),
    ]);
    assert.deepEqual(users, [{ id: "buyer" }, { id: "buyer" }]);
    assert.equal(refreshCalls, 1);
    await session.run(restore);
    assert.equal(refreshCalls, 2);
  });
  it("keeps memory token reads isolated and clears them", async () => {
    const store = new MemoryTokenStore();
    const input = { accessToken: "access", refreshToken: "refresh" };
    await store.write(input);
    input.accessToken = "mutated";
    const read = await store.read();
    assert.equal(read?.accessToken, "access");
    read!.accessToken = "also-mutated";
    assert.equal((await store.read())?.accessToken, "access");
    await store.clear();
    assert.equal(await store.read(), null);
  });

  it("returns pagination metadata alongside the unwrapped data", async () => {
    const tokens = new MemoryTokenStore();
    const fetcher: typeof fetch = async () =>
      Response.json({
        data: [{ id: "shop-1" }],
        meta: { page: 2, pageSize: 20, total: 41 },
      });
    const client = new ApiTransport({
      baseUrl: "https://api.example.test/api/v1",
      clientPlatform: "WEB",
      tokens,
      fetcher,
    });

    const page = await client.requestEnvelope<{ id: string }[]>("/admin/shops");

    assert.deepEqual(page.data, [{ id: "shop-1" }]);
    assert.deepEqual(page.meta, { page: 2, pageSize: 20, total: 41 });
  });

  it("shares concurrent refresh and retries safe reads once", async () => {
    const tokens = new MemoryTokenStore();
    await tokens.write({ accessToken: "stale", refreshToken: "refresh" });
    let refreshCalls = 0;
    let readCalls = 0;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/csrf")) {
        return Response.json({ data: { csrfToken: "csrf-test" } });
      }
      if (url.pathname.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Response.json({
          data: {
            accessToken: "fresh",
            expiresIn: 600,
            user: {},
            sessionId: "session",
          },
        });
      }

      readCalls += 1;
      if (new Headers(init?.headers).get("Authorization") !== "Bearer fresh")
        return unauthorized();
      return Response.json({ data: { ok: true } });
    };
    const client = new ApiTransport({
      baseUrl: "https://api.example.test/api/v1",
      clientPlatform: "WEB",
      tokens,
      fetcher,
    });

    const results = await Promise.all([
      client.request<{ ok: boolean }>("/products"),
      client.request<{ ok: boolean }>("/products"),
    ]);
    assert.deepEqual(results, [{ ok: true }, { ok: true }]);
    assert.equal(refreshCalls, 1);
    assert.equal(readCalls, 4);
    assert.equal((await tokens.read())?.accessToken, "fresh");
  });

  it("refreshes after an unauthorized mutation but never resends it", async () => {
    const tokens = new MemoryTokenStore();
    await tokens.write({ accessToken: "stale", refreshToken: "refresh" });
    let mutationCalls = 0;
    let refreshCalls = 0;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/csrf")) {
        return Response.json({ data: { csrfToken: "csrf-test" } });
      }
      if (url.pathname.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Response.json({
          data: {
            accessToken: "fresh",
            expiresIn: 600,
            user: {},
            sessionId: "session",
          },
        });
      }
      mutationCalls += 1;
      return unauthorized();
    };
    const client = new ApiTransport({
      baseUrl: "https://api.example.test/api/v1",
      clientPlatform: "WEB",
      tokens,
      fetcher,
    });

    await assert.rejects(
      client.request("/orders", {
        method: "POST",
        body: JSON.stringify({ item: "one" }),
      }),
      (error: unknown) =>
        error instanceof ApiClientError && error.status === 401,
    );
    assert.equal(mutationCalls, 1);
    assert.equal(refreshCalls, 1);
  });
});
