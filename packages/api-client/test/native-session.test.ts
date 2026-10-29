import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { WebSession } from "../src/auth/web-session.ts";
import { ExpoSession } from "../src/auth/expo-session.ts";
import { ApiClientError } from "../src/transport.ts";

type Platform = "WEB" | "ANDROID" | "IOS";
type Failure = 401 | 429 | 500 | 503 | "network" | "timeout";
async function fixture(platform: Platform) {
  let secureRefresh: string | null = null,
    cookieRefresh: string | null = null;
  let serial = 0,
    owner = "buyer-a",
    freshAccess = "";
  let refreshFailure: Failure | undefined, logoutFailure: Failure | undefined;
  let refreshCode = "SESSION_REVOKED",
    expired = false;
  const writes: string[] = [];
  const requests: {
    path: string;
    body: Record<string, unknown>;
    authorization: string | null;
  }[] = [];
  const failed = (failure: Failure) => {
    if (failure === "network") throw new TypeError("network unavailable");
    if (failure === "timeout")
      throw new DOMException("timed out", "AbortError");
    return Response.json(
      { error: { code: refreshCode, message: "Request failed" } },
      { status: failure },
    );
  };
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname,
      headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body ?? "{}"));
    requests.push({ path, body, authorization: headers.get("Authorization") });
    assert.equal(init?.credentials, platform === "WEB" ? "include" : "omit");
    if (path.endsWith("/auth/csrf")) {
      assert.equal(platform, "WEB");
      return Response.json({ data: { csrfToken: "fixture-csrf" } });
    }
    if (path.includes("/auth/")) {
      assert.equal(body.clientPlatform, platform);
      assert.equal(body.roles, undefined);
      assert.equal(
        headers.get("X-CSRF-Token"),
        platform === "WEB" ? "fixture-csrf" : null,
      );
    }
    if (path.endsWith("/auth/logout") || path.endsWith("/auth/refresh"))
      assert.equal(
        body.refreshToken,
        platform === "WEB" ? undefined : (secureRefresh ?? undefined),
      );
    if (path.endsWith("/auth/logout")) {
      if (logoutFailure !== undefined) return failed(logoutFailure);
      cookieRefresh = null;
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/auth/refresh") && refreshFailure !== undefined)
      return failed(refreshFailure);
    if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
      if (path.endsWith("/auth/login"))
        owner = String(body.email).startsWith("b@") ? "buyer-b" : "buyer-a";
      else await new Promise((resolve) => setTimeout(resolve, 10));
      serial++;
      freshAccess = `fixture-access-${serial}`;
      expired = false;
      const refresh = `fixture-refresh-${serial}`;
      if (platform === "WEB") cookieRefresh = refresh;
      return Response.json({
        data: {
          accessToken: freshAccess,
          ...(platform === "WEB" ? {} : { refreshToken: refresh }),
          user: { id: owner, roles: ["BUYER"] },
        },
      });
    }
    if (path.endsWith("/admin/users"))
      return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    if (expired)
      return Response.json(
        { error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    return Response.json({
      data: path.endsWith("/users/me") ? { id: owner, roles: ["BUYER"] } : [],
    });
  };
  const session =
    platform === "WEB"
      ? new WebSession("https://example.test/api/v1", fetcher)
      : new ExpoSession({
          baseUrl: "https://example.test/api/v1",
          clientPlatform: platform,
          fetcher,
          secureStore: {
            getItemAsync: async () => secureRefresh,
            setItemAsync: async (_, value) => {
              secureRefresh = value;
              writes.push(value);
            },
            deleteItemAsync: async () => {
              secureRefresh = null;
            },
          },
        });
  if (session instanceof WebSession) await session.clear();
  return {
    session,
    requests,
    writes,
    setRefreshFailure(value?: Failure, code = "SESSION_REVOKED") {
      refreshFailure = value;
      refreshCode = code;
    },
    setLogoutFailure(value?: Failure) {
      logoutFailure = value;
    },
    expireAccess() {
      expired = true;
    },
    refresh: () => (platform === "WEB" ? cookieRefresh : secureRefresh),
    async authorization() {
      await session.api.request("/products");
      return requests.at(-1)?.authorization;
    },
    async cleanup() {
      if (session instanceof WebSession) await session.clear();
    },
  };
}

describe("T131 one contract, Web cookie/CSRF and native SecureStore/body", () => {
  for (const platform of ["WEB", "ANDROID", "IOS"] as const) {
    for (const code of ["SESSION_REVOKED", "INVALID_REFRESH"])
      it(`${platform}: restore 401 ${code} clears local access`, async () => {
        const f = await fixture(platform);
        try {
          await f.session.login("a@example.test", "fixture-password");
          f.setRefreshFailure(401, code);
          await assert.rejects(
            f.session.restore(),
            (e) => e instanceof ApiClientError && e.status === 401,
          );
          assert.equal(await f.authorization(), null);
          if (platform !== "WEB") assert.equal(f.refresh(), null);
        } finally {
          await f.cleanup();
        }
      });
    for (const failure of ["network", "timeout", 429, 500, 503] as const)
      it(`${platform}: restore ${failure} preserves credentials and can retry`, async () => {
        const f = await fixture(platform);
        try {
          await f.session.login("a@example.test", "fixture-password");
          const saved = f.refresh();
          f.setRefreshFailure(failure);
          await assert.rejects(f.session.restore());
          assert.equal(f.refresh(), saved);
          assert.equal(await f.authorization(), "Bearer fixture-access-1");
          f.setRefreshFailure();
          await f.session.restore();
          assert.notEqual(f.refresh(), saved);
        } finally {
          await f.cleanup();
        }
      });
    for (const outcome of [
      204,
      "repeat204",
      401,
      "network",
      "timeout",
      429,
      500,
      503,
    ] as const)
      it(`${platform}: logout ${outcome} follows terminal/retry policy`, async () => {
        const f = await fixture(platform);
        try {
          await f.session.login("a@example.test", "fixture-password");
          const saved = f.refresh();
          if (outcome === 204 || outcome === "repeat204") {
            await f.session.logout();
            if (outcome === "repeat204") await f.session.logout();
          } else {
            f.setLogoutFailure(outcome);
            if (outcome === 401) f.setRefreshFailure(401);
            await assert.rejects(f.session.logout());
          }
          if (outcome === 204 || outcome === "repeat204" || outcome === 401) {
            assert.equal(await f.authorization(), null);
            if (platform !== "WEB") assert.equal(f.refresh(), null);
          } else {
            assert.equal(f.refresh(), saved);
            assert.equal(await f.authorization(), "Bearer fixture-access-1");
            f.setLogoutFailure();
            await f.session.logout();
            assert.equal(await f.authorization(), null);
          }
        } finally {
          await f.cleanup();
        }
      });
    for (const failure of ["network", "timeout", 429, 500, 503] as const)
      it(`${platform}: automatic refresh ${failure} preserves refresh credential and retry recovers`, async () => {
        const f = await fixture(platform);
        try {
          await f.session.login("a@example.test", "fixture-password");
          const saved = f.refresh();
          f.expireAccess();
          f.setRefreshFailure(failure);
          await assert.rejects(f.session.api.request("/products"));
          assert.equal(f.refresh(), saved);
          f.setRefreshFailure();
          await f.session.api.request("/products");
          assert.equal(f.refresh(), "fixture-refresh-2");
          assert.equal(await f.authorization(), "Bearer fixture-access-2");
        } finally {
          await f.cleanup();
        }
      });
    it(`${platform}: concurrent restore/automatic refresh are single-flight and rotate`, async () => {
      const f = await fixture(platform);
      try {
        await f.session.login("a@example.test", "fixture-password");
        await Promise.all([f.session.restore(), f.session.restore()]);
        assert.equal(
          f.requests.filter((r) => r.path.endsWith("/auth/refresh")).length,
          1,
        );
        assert.equal(f.refresh(), "fixture-refresh-2");
        f.expireAccess();
        await Promise.all([
          f.session.api.request("/products"),
          f.session.api.request("/products"),
        ]);
        assert.equal(
          f.requests.filter((r) => r.path.endsWith("/auth/refresh")).length,
          2,
        );
        assert.equal(f.refresh(), "fixture-refresh-3");
        assert.ok(
          f.writes.every((value) => value.startsWith("fixture-refresh-")),
        );
      } finally {
        await f.cleanup();
      }
    });
    it(`${platform}: label does not grant roles, denial propagates, account switch replaces credentials`, async () => {
      const f = await fixture(platform);
      try {
        assert.deepEqual(
          await f.session.login("a@example.test", "fixture-password"),
          { id: "buyer-a", roles: ["BUYER"] },
        );
        await assert.rejects(
          f.session.api.request("/admin/users"),
          (e) => e instanceof ApiClientError && e.status === 403,
        );
        await f.session.logout();
        assert.equal(await f.authorization(), null);
        assert.deepEqual(
          await f.session.login("b@example.test", "fixture-password"),
          { id: "buyer-b", roles: ["BUYER"] },
        );
        assert.equal(await f.authorization(), "Bearer fixture-access-2");
      } finally {
        await f.cleanup();
      }
    });
  }
  it("native instances are isolated and only refresh values reach SecureStore", async () => {
    const a = await fixture("ANDROID"),
      b = await fixture("IOS");
    await a.session.login("a@example.test", "fixture-password");
    assert.equal(await b.authorization(), null);
    assert.equal(b.refresh(), null);
    assert.deepEqual(a.writes, ["fixture-refresh-1"]);
  });
  it("native source has no plaintext or AsyncStorage fallback", async () => {
    async function sources(directory: URL): Promise<string[]> {
      const entries = await readdir(directory, { withFileTypes: true });
      return (
        await Promise.all(
          entries.map((e) =>
            e.isDirectory()
              ? sources(new URL(`${e.name}/`, directory))
              : /\.tsx?$/.test(e.name)
                ? readFile(new URL(e.name, directory), "utf8").then((text) => [
                    text,
                  ])
                : [],
          ),
        )
      ).flat();
    }
    const source = [
      await readFile(
        new URL("../src/auth/expo-session.ts", import.meta.url),
        "utf8",
      ),
      ...(await sources(new URL("../../../apps/mobile/src/", import.meta.url))),
    ].join("\n");
    assert.doesNotMatch(
      source,
      /AsyncStorage|localStorage|sessionStorage|writeFile(?:Sync)?\s*\(/,
    );
    assert.doesNotMatch(source, /setItemAsync\([^;]*accessToken/);
  });
});
