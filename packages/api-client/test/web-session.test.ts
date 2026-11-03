import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebSession } from "../src/auth/web-session.ts";
import { ApiClientError } from "../src/transport.ts";

type Failure = 401 | 429 | 500 | 503 | "network" | "timeout";
async function fixture() {
  let cookieRefresh: string | null = null;
  let serial = 0,
    owner = "buyer-a",
    freshAccess = "";
  let refreshFailure: Failure | undefined, logoutFailure: Failure | undefined;
  let refreshCode = "SESSION_REVOKED",
    expired = false;
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
    assert.equal(init?.credentials, "include");
    if (path.endsWith("/auth/csrf"))
      return Response.json({ data: { csrfToken: "fixture-csrf" } });
    if (path.includes("/auth/")) {
      assert.equal(body.clientPlatform, "WEB");
      assert.equal(body.roles, undefined);
      assert.equal(headers.get("X-CSRF-Token"), "fixture-csrf");
    }
    if (path.endsWith("/auth/logout") || path.endsWith("/auth/refresh"))
      assert.equal(body.refreshToken, undefined);
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
      cookieRefresh = `fixture-refresh-${serial}`;
      return Response.json({
        data: {
          accessToken: freshAccess,
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
  const session = new WebSession("https://example.test/api/v1", fetcher);
  await session.clear();
  return {
    session,
    requests,
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
    refresh: () => cookieRefresh,
    async authorization() {
      await session.api.request("/products");
      return requests.at(-1)?.authorization;
    },
    cleanup: () => session.clear(),
  };
}

describe("T131 one contract, Web cookie/CSRF session", () => {
  for (const code of ["SESSION_REVOKED", "INVALID_REFRESH"])
    it(`restore 401 ${code} clears local access`, async () => {
      const f = await fixture();
      try {
        await f.session.login("a@example.test", "fixture-password");
        f.setRefreshFailure(401, code);
        await assert.rejects(
          f.session.restore(),
          (e) => e instanceof ApiClientError && e.status === 401,
        );
        assert.equal(await f.authorization(), null);
      } finally {
        await f.cleanup();
      }
    });
  for (const failure of ["network", "timeout", 429, 500, 503] as const)
    it(`restore ${failure} preserves credentials and can retry`, async () => {
      const f = await fixture();
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
    it(`logout ${outcome} follows terminal/retry policy`, async () => {
      const f = await fixture();
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
    it(`automatic refresh ${failure} preserves refresh credential and retry recovers`, async () => {
      const f = await fixture();
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
  it("concurrent restore/automatic refresh are single-flight and rotate", async () => {
    const f = await fixture();
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
    } finally {
      await f.cleanup();
    }
  });
  it("label does not grant roles, denial propagates, account switch replaces credentials", async () => {
    const f = await fixture();
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
});
