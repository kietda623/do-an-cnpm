import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryTokenStore } from "../src/auth/types.ts";
import { ApiClientError, ApiTransport } from "../src/transport.ts";

const unauthorized = () =>
  Response.json(
    { error: { code: "UNAUTHORIZED", message: "Sign in again", requestId: "test" } },
    { status: 401 },
  );

describe("API transport auth behavior", () => {
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

  it("shares concurrent refresh and retries safe reads once", async () => {
    const tokens = new MemoryTokenStore();
    await tokens.write({ accessToken: "stale", refreshToken: "refresh" });
    let refreshCalls = 0;
    let readCalls = 0;
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return Response.json({
          data: { accessToken: "fresh", expiresIn: 600, user: {}, sessionId: "session" },
        });
      }

      readCalls += 1;
      if (new Headers(init?.headers).get("Authorization") !== "Bearer fresh") return unauthorized();
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
      if (url.pathname.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Response.json({
          data: { accessToken: "fresh", expiresIn: 600, user: {}, sessionId: "session" },
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
      client.request("/orders", { method: "POST", body: JSON.stringify({ item: "one" }) }),
      (error: unknown) => error instanceof ApiClientError && error.status === 401,
    );
    assert.equal(mutationCalls, 1);
    assert.equal(refreshCalls, 1);
  });
});
