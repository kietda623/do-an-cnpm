import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExpoSession, SessionChangedError } from "../src/auth/expo-session.ts";
import { ApiClientError } from "../src/transport.ts";

describe("native session", () => {
  for (const mode of ["login", "restore", "automatic refresh"] as const)
    for (const deletionFails of [false, true])
      it(`invalidates on ${mode} storage write failure (delete fails: ${deletionFails})`, async () => {
        let stored: string | null = null;
        let failWrite = false;
        let notices = 0;
        let serial = 0;
        let refreshCalls = 0;
        let allowProtected = false;
        let lastAuthorization: string | null = null;
        const session = new ExpoSession({
          baseUrl: "https://example.test/api/v1",
          clientPlatform: "ANDROID",
          secureStore: {
            getItemAsync: async () => stored,
            setItemAsync: async (_, value) => {
              if (failWrite) throw new Error("storage unavailable");
              stored = value;
            },
            deleteItemAsync: async () => {
              if (deletionFails) throw new Error("delete unavailable");
              stored = null;
            },
          },
          fetcher: async (input, init) => {
            const path = new URL(String(input)).pathname;
            if (
              path.endsWith("/auth/login") ||
              path.endsWith("/auth/refresh")
            ) {
              if (path.endsWith("/auth/refresh")) refreshCalls++;
              serial++;
              return Response.json({
                data: {
                  accessToken: `a${serial}`,
                  refreshToken: `r${serial}`,
                  user: {},
                },
              });
            }
            lastAuthorization = new Headers(init?.headers).get("Authorization");
            return allowProtected || path.endsWith("/products")
              ? Response.json({ data: [] })
              : Response.json(
                  { error: { code: "UNAUTHORIZED" } },
                  { status: 401 },
                );
          },
          onSessionInvalid: () => {
            notices++;
          },
        });
        await session.login("buyer@example.test", "fixture-password");
        failWrite = true;
        const operation =
          mode === "login"
            ? session.login("buyer@example.test", "fixture-password")
            : mode === "restore"
              ? session.restore()
              : session.api.request("/users/me");
        let failure: unknown;
        await assert.rejects(operation, (error) => {
          failure = error;
          return true;
        });
        assert.equal(notices, 1);
        assert.equal((failure as Error).name, "SessionStorageError");
        assert.equal(stored, deletionFails ? "r1" : null);
        const callsBefore = refreshCalls;
        assert.equal(await session.restore(), null);
        assert.equal(refreshCalls, callsBefore);
        allowProtected = true;
        await session.api.request("/products");
        assert.equal(lastAuthorization, null);
        failWrite = false;
        await session.login("buyer@example.test", "fixture-password");
        await session.api.request("/products");
        assert.equal(lastAuthorization, `Bearer a${serial}`);
        assert.equal(stored, `r${serial}`);
      });
  it("invalidates UI even when SecureStore deletion fails", async () => {
    let notices = 0;
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => "r0",
        setItemAsync: async () => {},
        deleteItemAsync: async () => {
          throw new Error("storage unavailable");
        },
      },
      fetcher: async () =>
        Response.json({ error: { code: "INVALID_REFRESH" } }, { status: 401 }),
      onSessionInvalid: () => {
        notices++;
      },
    });
    await assert.rejects(session.restore());
    assert.equal(notices, 1);
  });
  it("does not persist an automatic refresh finishing after logout", async () => {
    let stored: string | null = "r0";
    let release!: (response: Response) => void;
    let started!: () => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/refresh")) {
          started();
          return pending;
        }
        if (path.endsWith("/auth/logout"))
          return new Response(null, { status: 204 });
        return Response.json(
          { error: { code: "UNAUTHORIZED" } },
          { status: 401 },
        );
      },
    });
    const request = session.api.request("/users/me");
    const outcome = request.catch(() => undefined);
    await entered;
    await session.logout();
    assert.equal(stored, null);
    release(
      Response.json({
        data: { accessToken: "a1", refreshToken: "r1", user: {} },
      }),
    );
    await outcome;
    assert.equal(stored, null);
  });
  it("does not let an old refresh body overwrite credentials after account switch", async () => {
    let stored: string | null = null;
    let owner = "";
    let releaseRefreshBody!: () => void;
    let refreshBodyStarted!: () => void;
    const bodyGate = new Promise<void>((resolve) => {
      releaseRefreshBody = resolve;
    });
    const refreshStarted = new Promise<void>((resolve) => {
      refreshBodyStarted = resolve;
    });
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login")) {
          owner = String(JSON.parse(String(init?.body)).email).startsWith("b@")
            ? "buyer-b"
            : "buyer-a";
          return Response.json({
            data: {
              accessToken: `access-${owner}`,
              refreshToken: `refresh-${owner}`,
              user: { id: owner, roles: ["BUYER"] },
            },
          });
        }
        if (path.endsWith("/auth/logout"))
          return new Response(null, { status: 204 });
        if (path.endsWith("/auth/refresh")) {
          const response = Response.json({
            data: {
              accessToken: `access-${owner}`,
              refreshToken: `refresh-${owner}`,
              user: { id: owner, roles: ["BUYER"] },
            },
          });
          const parse = response.json.bind(response);
          response.json = async () => {
            refreshBodyStarted();
            await bodyGate;
            return parse();
          };
          return response;
        }
        if (path.endsWith("/users/me"))
          return Response.json(
            { error: { code: "UNAUTHORIZED" } },
            { status: 401 },
          );
        return Response.json({ data: [] });
      },
    });

    await session.login("a@example.test", "fixture-password");
    const oldRequest = session.api.request("/users/me");
    const oldRequestFailure = assert.rejects(oldRequest, SessionChangedError);
    await refreshStarted;

    await session.logout();
    await session.login("b@example.test", "fixture-password");
    assert.equal(stored, "refresh-buyer-b");

    releaseRefreshBody();
    await oldRequestFailure;
    assert.equal(stored, "refresh-buyer-b");
  });
  function setup(status: number | "network" | "timeout") {
    let refresh: string | null = "refresh-secret";
    let cleared = 0;
    let notices = 0;
    const secure = {
      getItemAsync: async () => refresh,
      setItemAsync: async (_: string, value: string) => {
        refresh = value;
      },
      deleteItemAsync: async () => {
        refresh = null;
        cleared++;
      },
    };
    const fetcher: typeof fetch = async () => {
      if (status === "network") throw new TypeError("network error");
      if (status === "timeout")
        throw new DOMException("timed out", "AbortError");
      return Response.json(
        { error: { code: "SESSION_REVOKED", message: "failed" } },
        { status },
      );
    };
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: secure,
      fetcher,
      onSessionInvalid: () => {
        notices++;
      },
    });
    return {
      session,
      getRefresh: () => refresh,
      getCleared: () => cleared,
      getNotices: () => notices,
    };
  }
  it("clears secure token and session on any refresh 401", async () => {
    const test = setup(401);
    await assert.rejects(test.session.restore());
    assert.equal(test.getRefresh(), null);
    assert.equal(test.getCleared(), 1);
    assert.equal(test.getNotices(), 1);
  });
  for (const status of [429, 500, "network", "timeout"] as const)
    it(`preserves refresh on ${status}`, async () => {
      const test = setup(status);
      await assert.rejects(test.session.restore());
      assert.equal(test.getRefresh(), "refresh-secret");
      assert.equal(test.getCleared(), 0);
      assert.equal(test.getNotices(), 0);
    });
  for (const status of [429, 500, "network", "timeout"] as const)
    it(`preserves credentials and session when logout fails with ${status}`, async () => {
      const test = setup(status);
      await assert.rejects(test.session.logout());
      assert.equal(test.getRefresh(), "refresh-secret");
      assert.equal(test.getCleared(), 0);
      assert.equal(test.getNotices(), 0);
    });
  it("registers with the native platform and persists the returned session securely", async () => {
    let stored: string | null = null;
    let requestBody: Record<string, unknown> | undefined;
    let authorization: string | null = null;
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/register")) {
          requestBody = JSON.parse(String(init?.body));
          return Response.json(
            {
              data: {
                accessToken: "access-registration",
                refreshToken: "refresh-registration",
                user: { id: "registered-buyer", roles: ["BUYER"] },
              },
            },
            { status: 201 },
          );
        }
        authorization = new Headers(init?.headers).get("Authorization");
        return Response.json({ data: [] });
      },
    });

    const user = await session.register(
      "Buyer Name",
      "buyer@example.test",
      "a-valid-password",
    );
    await session.api.request("/products");

    assert.deepEqual(requestBody, {
      fullName: "Buyer Name",
      email: "buyer@example.test",
      password: "a-valid-password",
      clientPlatform: "ANDROID",
    });
    assert.equal(user.id, "registered-buyer");
    assert.equal(stored, "refresh-registration");
    assert.equal(authorization, "Bearer access-registration");
  });
  it("rotates in secure storage and logout clears credentials", async () => {
    let stored: string | null = null;
    const requests: Array<{
      path: string;
      body: Record<string, unknown>;
      credentials?: RequestCredentials;
    }> = [];
    const secureStore = {
      getItemAsync: async () => stored,
      setItemAsync: async (_: string, value: string) => {
        stored = value;
      },
      deleteItemAsync: async () => {
        stored = null;
      },
    };
    const fetcher: typeof fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push({
        path,
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        credentials: init?.credentials,
      });
      if (path.endsWith("/auth/logout"))
        return new Response(null, { status: 204 });
      return Response.json({
        data: {
          accessToken: "access-secret",
          refreshToken: path.endsWith("/auth/login")
            ? "first-refresh"
            : "rotated-refresh",
          user: { id: "buyer" },
        },
      });
    };
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "IOS",
      secureStore,
      fetcher,
    });
    await session.login("buyer@example.test", "password");
    assert.equal(stored, "first-refresh");
    await session.restore();
    assert.equal(stored, "rotated-refresh");
    await session.logout();
    assert.equal(stored, null);
    assert.deepEqual(
      requests.map((entry) => entry.credentials),
      ["omit", "omit", "omit"],
    );
    assert.equal(requests[1]?.body.refreshToken, "first-refresh");
    assert.equal(requests[2]?.body.refreshToken, "rotated-refresh");
    assert.equal(requests[0]?.body.clientPlatform, "IOS");
  });
  it("resumes through /users/me and shares one refresh with concurrent business requests", async () => {
    let stored: string | null = null;
    let serial = 0;
    let expired = false;
    let refreshCalls = 0;
    const user = { id: "buyer-a", roles: ["BUYER"] };
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
          if (path.endsWith("/auth/refresh")) {
            refreshCalls++;
            await new Promise((resolve) => setTimeout(resolve, 10));
            expired = false;
          }
          serial++;
          return Response.json({
            data: {
              accessToken: `access-${serial}`,
              refreshToken: `refresh-${serial}`,
              user,
            },
          });
        }
        if (
          (path.endsWith("/users/me") || path.endsWith("/products")) &&
          expired
        )
          return Response.json(
            { error: { code: "INVALID_ACCESS_TOKEN" } },
            { status: 401 },
          );
        return Response.json({ data: path.endsWith("/users/me") ? user : [] });
      },
    });

    await session.login("buyer@example.test", "fixture-password");
    expired = true;
    const [resumed] = await Promise.all([
      session.resume(),
      session.api.request("/products"),
    ]);

    assert.deepEqual(resumed, user);
    assert.equal(refreshCalls, 1);
    assert.equal(stored, "refresh-2");
  });
  for (const [code, shouldClear] of [
    ["ACCOUNT_LOCKED", true],
    ["FORBIDDEN", false],
  ] as const)
    it(`resume ${code} ${shouldClear ? "clears" : "keeps"} the session`, async () => {
      let stored: string | null = null;
      let invalidations = 0;
      const session = new ExpoSession({
        baseUrl: "https://example.test/api/v1",
        clientPlatform: "ANDROID",
        secureStore: {
          getItemAsync: async () => stored,
          setItemAsync: async (_, value) => {
            stored = value;
          },
          deleteItemAsync: async () => {
            stored = null;
          },
        },
        fetcher: async (input) =>
          new URL(String(input)).pathname.endsWith("/auth/login")
            ? Response.json({
                data: {
                  accessToken: "access-1",
                  refreshToken: "refresh-1",
                  user: { id: "buyer-a", roles: ["BUYER"] },
                },
              })
            : Response.json(
                { error: { code, message: "Forbidden" } },
                { status: 403 },
              ),
        onSessionInvalid: () => {
          invalidations++;
        },
      });
      await session.login("buyer@example.test", "fixture-password");

      await assert.rejects(
        session.resume(),
        (error) => error instanceof ApiClientError && error.status === 403,
      );

      assert.equal(stored, shouldClear ? null : "refresh-1");
      assert.equal(invalidations, shouldClear ? 1 : 0);
    });
  it("does not return an old generation response after logout and another login", async () => {
    let stored: string | null = null;
    let owner = "buyer-a";
    let bodyStarted!: () => void;
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const parsed = new Promise<void>((resolve) => {
      bodyStarted = resolve;
    });
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login")) {
          owner = String(JSON.parse(String(init?.body)).email).startsWith("b@")
            ? "buyer-b"
            : "buyer-a";
          return Response.json({
            data: {
              accessToken: `access-${owner}`,
              refreshToken: `refresh-${owner}`,
              user: { id: owner, roles: ["BUYER"] },
            },
          });
        }
        if (path.endsWith("/auth/logout"))
          return new Response(null, { status: 204 });
        if (path.endsWith("/products"))
          return new Response(
            new ReadableStream<Uint8Array>({
              start(streamController) {
                controller = streamController;
              },
              pull() {
                bodyStarted();
                return new Promise<void>(() => {});
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        return Response.json({ data: [] });
      },
    });
    await session.login("a@example.test", "fixture-password");
    const oldRequest = session.api.request("/products");
    await parsed;

    await session.logout();
    await session.login("b@example.test", "fixture-password");
    controller.enqueue(
      new TextEncoder().encode('{"data":["buyer-a private result"]}'),
    );
    controller.close();

    await assert.rejects(oldRequest, /session changed/i);
    assert.equal(stored, "refresh-buyer-b");
  });
  it("classifies a late fetch response as stale after logout and account switch", async () => {
    let stored: string | null = null;
    let resolveProducts!: (response: Response) => void;
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveProducts = resolve;
    });
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      },
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith("/auth/login")) {
          const email = JSON.parse(String(init?.body)).email as string;
          return Response.json({
            data: {
              accessToken: `access-${email}`,
              refreshToken: `refresh-${email}`,
              user: { id: email, roles: ["BUYER"] },
            },
          });
        }
        if (path.endsWith("/auth/logout"))
          return new Response(null, { status: 204 });
        if (path.endsWith("/products")) {
          requestStarted();
          return pendingResponse;
        }
        return Response.json({ data: [] });
      },
    });
    await session.login("buyer@example.test", "fixture-password");
    const oldRequest = session.api.request("/products");
    const staleRejection = assert.rejects(
      oldRequest,
      (error) => error instanceof SessionChangedError,
    );
    await started;

    await session.logout();
    await session.login("other@example.test", "fixture-password");
    resolveProducts(Response.json({ data: ["old account result"] }));

    await staleRejection;
    assert.equal(stored, "refresh-other@example.test");
  });
  for (const deletionFails of [false, true])
    it(`does not retry logout or clear twice after refresh invalidates the session (deletion fails: ${deletionFails})`, async () => {
      let stored: string | null = "r0";
      let cleared = 0;
      let notices = 0;
      const paths: string[] = [];
      const storageError = new Error("storage unavailable");
      const session = new ExpoSession({
        baseUrl: "https://example.test/api/v1",
        clientPlatform: "ANDROID",
        secureStore: {
          getItemAsync: async () => stored,
          setItemAsync: async () => {},
          deleteItemAsync: async () => {
            cleared++;
            if (deletionFails) throw storageError;
            stored = null;
          },
        },
        fetcher: async (input) => {
          paths.push(new URL(String(input)).pathname);
          return Response.json(
            { error: { code: "UNAUTHORIZED" } },
            { status: 401 },
          );
        },
        onSessionInvalid: () => {
          notices++;
        },
      });

      await assert.rejects(session.logout(), (error: unknown) =>
        deletionFails
          ? error === storageError
          : error instanceof ApiClientError && error.status === 401,
      );
      assert.deepEqual(paths, ["/api/v1/auth/logout", "/api/v1/auth/refresh"]);
      assert.equal(cleared, 1);
      assert.equal(notices, 1);
      assert.equal(stored, deletionFails ? "r0" : null);
    });
  it("retries logout with rotated credentials after a successful refresh", async () => {
    let stored: string | null = "r0";
    let cleared = 0;
    let notices = 0;
    const requests: Array<{
      path: string;
      refreshToken: string;
      authorization: string | null;
    }> = [];
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore: {
        getItemAsync: async () => stored,
        setItemAsync: async (_, value) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
          cleared++;
        },
      },
      fetcher: async (input, init) => {
        const path = new URL(String(input)).pathname;
        const body = JSON.parse(String(init?.body)) as { refreshToken: string };
        const authorization = new Headers(init?.headers).get("Authorization");
        requests.push({ path, refreshToken: body.refreshToken, authorization });
        if (path.endsWith("/auth/refresh"))
          return Response.json({
            data: { accessToken: "a1", refreshToken: "r1" },
          });
        return body.refreshToken === "r1" && authorization === "Bearer a1"
          ? new Response(null, { status: 204 })
          : Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
      },
      onSessionInvalid: () => {
        notices++;
      },
    });

    await session.logout();
    assert.deepEqual(requests, [
      { path: "/api/v1/auth/logout", refreshToken: "r0", authorization: null },
      { path: "/api/v1/auth/refresh", refreshToken: "r0", authorization: null },
      {
        path: "/api/v1/auth/logout",
        refreshToken: "r1",
        authorization: "Bearer a1",
      },
    ]);
    assert.equal(stored, null);
    assert.equal(cleared, 1);
    assert.equal(notices, 1);
  });
  for (const status of [401, 429, 503] as const)
    it(`handles automatic refresh ${status} without losing recoverable sessions`, async () => {
      let stored: string | null = "refresh-secret";
      let invalidations = 0;
      const secureStore = {
        getItemAsync: async () => stored,
        setItemAsync: async (_: string, value: string) => {
          stored = value;
        },
        deleteItemAsync: async () => {
          stored = null;
        },
      };
      const fetcher: typeof fetch = async (input) =>
        new URL(String(input)).pathname.endsWith("/auth/refresh")
          ? Response.json(
              { error: { code: "SERVER_ERROR", message: "failed" } },
              { status },
            )
          : Response.json(
              { error: { code: "UNAUTHORIZED", message: "failed" } },
              { status: 401 },
            );
      const session = new ExpoSession({
        baseUrl: "https://example.test/api/v1",
        clientPlatform: "ANDROID",
        secureStore,
        fetcher,
        onSessionInvalid: () => {
          invalidations++;
        },
      });
      await assert.rejects(session.api.request("/users/me"));
      assert.equal(stored, status === 401 ? null : "refresh-secret");
      assert.equal(invalidations, status === 401 ? 1 : 0);
    });
  it("does not pass arbitrary error contents to the logger", async () => {
    const logged: string[] = [];
    const secureStore = {
      getItemAsync: async () => "secret",
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
    const session = new ExpoSession({
      baseUrl: "https://example.test/api/v1",
      clientPlatform: "ANDROID",
      secureStore,
      fetcher: async () =>
        Response.json(
          { error: { code: "SECRET", message: "secret" } },
          { status: 401 },
        ),
      onRefreshError: (code) => logged.push(code),
    });
    await assert.rejects(session.restore());
    assert.deepEqual(logged, []);
  });
});
