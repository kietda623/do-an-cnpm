import { ApiClientError } from "@marketplace/api-client";
import { SessionChangedError } from "@marketplace/api-client/auth/expo-session";
import { createMobileQueryClient } from "../src/features/api/query-client";

test("queries do not retry client errors or stale session results", () => {
  const client = createMobileQueryClient();
  const retry = client.getDefaultOptions().queries?.retry;
  expect(typeof retry).toBe("function");
  if (typeof retry !== "function")
    throw new Error("query retry policy missing");

  for (const status of [400, 401, 403, 404, 429]) {
    expect(retry(0, new ApiClientError("request failed", status))).toBe(false);
  }
  expect(retry(0, new SessionChangedError())).toBe(false);
  client.clear();
});

test.each([
  [new TypeError("network unavailable"), 0, true],
  [new TypeError("network unavailable"), 1, true],
  [new TypeError("network unavailable"), 2, false],
  [new ApiClientError("server error", 500), 0, true],
  [new ApiClientError("server error", 503), 1, true],
  [new ApiClientError("server error", 500), 2, false],
])(
  "query retry policy for %p after %i failures is %s",
  (error, failures, expected) => {
    const client = createMobileQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;
    expect(typeof retry).toBe("function");
    if (typeof retry !== "function")
      throw new Error("query retry policy missing");
    expect(retry(failures, error)).toBe(expected);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    client.clear();
  },
);
