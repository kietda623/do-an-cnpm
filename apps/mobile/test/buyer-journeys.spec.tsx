import React, { useState } from "react";
import { Text, Platform } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Home from "../src/app/index";
import Login from "../src/app/login";
import {
  SessionProvider,
  useSession,
} from "../src/features/auth/session-provider";

let mockStored: string | null = null;
let mockAccount = "buyer-a";
let mockSerial = 0;
let mockRefreshFailure: "network" | 401 | undefined;
let mockLogoutFails = false;
let mockErrorCode = "SESSION_REVOKED";
let mockNavigate: (path: string) => void;
const mockWrites: string[] = [];
const mockCalls: string[] = [];
const mockRouter = {
  push: (path: string) => mockNavigate(path),
  replace: (path: string) => mockNavigate(path),
};
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { apiBaseUrl: "https://example.test/api/v1" } },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 32, bottom: 16, left: 0, right: 0 }),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => mockStored),
  setItemAsync: jest.fn(async (_key: string, value: string) => {
    mockStored = value;
    mockWrites.push(value);
  }),
  deleteItemAsync: jest.fn(async () => {
    mockStored = null;
  }),
}));

// Actual provider, ExpoSession and ApiTransport; only OS/router/fetch are doubles.
function Screens() {
  const [path, setPath] = useState("/");
  mockNavigate = setPath;
  const { user } = useSession();
  return (
    <>
      <Text>Session: {user?.id ?? "anonymous"}</Text>
      {path === "/login" ? <Login /> : <Home />}
    </>
  );
}
function Journey() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}
const originalFetch = globalThis.fetch;
beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android");
  mockStored = null;
  mockAccount = "buyer-a";
  mockSerial = 0;
  mockRefreshFailure = undefined;
  mockLogoutFails = false;
  mockErrorCode = "SESSION_REVOKED";
  mockWrites.length = 0;
  mockCalls.length = 0;
  globalThis.fetch = jest.fn(async (input, init) => {
    const path = new URL(String(input)).pathname;
    mockCalls.push(path);
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBeNull();
    if (path.endsWith("/auth/refresh")) {
      if (mockRefreshFailure === "network")
        throw new TypeError("network unavailable");
      if (mockRefreshFailure === 401)
        return Response.json(
          { error: { code: mockErrorCode } },
          { status: 401 },
        );
    }
    if (path.endsWith("/auth/logout")) {
      if (mockLogoutFails) throw new TypeError("network unavailable");
      return new Response(null, { status: 204 });
    }
    if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
      const body = JSON.parse(String(init?.body));
      expect(body.clientPlatform).toBe("ANDROID");
      if (path.endsWith("/auth/refresh"))
        expect(body.refreshToken).toBe(mockStored);
      else
        mockAccount = body.email.startsWith("second") ? "buyer-b" : "buyer-a";
      mockSerial++;
      return Response.json({
        data: {
          accessToken: `fixture-access-${mockSerial}`,
          refreshToken: `fixture-refresh-${mockSerial}`,
          user: { id: mockAccount },
        },
      });
    }
    if (path.endsWith("/products"))
      return Response.json({
        data: [{ id: mockAccount, name: `Public product ${mockAccount}` }],
      });
    throw new Error(`Unexpected fixture endpoint ${path}`);
  });
});
afterAll(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

async function submitLogin(email = "first@example.test") {
  fireEvent.changeText(await screen.findByPlaceholderText("Email"), email);
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu"),
    "fixture-password",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng nhập/i }));
  });
  await screen.findByRole("button", { name: /Đăng xuất/i });
}

test("B01/B02: login, real client product request, logout removes session and old screen state", async () => {
  render(<Journey />);
  await screen.findByText("Public product buyer-a");
  fireEvent.press(screen.getByRole("button", { name: /Đăng nhập/i }));
  await submitLogin();
  expect(screen.getByText("Session: buyer-a")).toBeTruthy();
  expect(mockStored).toBe("fixture-refresh-1");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng xuất/i }));
  });
  await screen.findByPlaceholderText("Email");
  expect(mockStored).toBeNull();
  expect(screen.getByText("Session: anonymous")).toBeTruthy();
  expect(screen.queryByText("Public product buyer-a")).toBeNull();
});
test("B02: process-like provider remount restores with refresh and persists each rotation", async () => {
  mockStored = "fixture-refresh-seeded";
  const first = render(<Journey />);
  await screen.findByText("Session: buyer-a");
  expect(mockStored).toBe("fixture-refresh-1");
  first.unmount();
  render(<Journey />);
  await screen.findByText("Session: buyer-a");
  expect(mockStored).toBe("fixture-refresh-2");
  expect(
    mockCalls.filter((path) => path.endsWith("/auth/refresh")),
  ).toHaveLength(2);
  expect(mockWrites).toEqual(["fixture-refresh-1", "fixture-refresh-2"]);
});
test("B02: network failure preserves refresh and retries restoration", async () => {
  mockStored = "fixture-refresh-seeded";
  mockRefreshFailure = "network";
  render(<Journey />);
  await screen.findByText(
    "Không thể khôi phục phiên. Kiểm tra kết nối rồi thử lại.",
  );
  expect(mockStored).toBe("fixture-refresh-seeded");
  mockRefreshFailure = undefined;
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Thử lại/i }));
  });
  await screen.findByText("Session: buyer-a");
  expect(mockStored).toBe("fixture-refresh-1");
});
for (const code of ["SESSION_REVOKED", "INVALID_REFRESH"])
  test(`B02: refresh401 ${code} clears storage, user and screen state`, async () => {
    mockStored = "fixture-refresh-seeded";
    mockRefreshFailure = 401;
    mockErrorCode = code;
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(<Journey />);
      await screen.findByPlaceholderText("Email");
      expect(mockStored).toBeNull();
      expect(screen.getByText("Session: anonymous")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Đăng xuất/i })).toBeNull();
      expect(warning).toHaveBeenCalledWith(`Refresh failed: ${code}`);
    } finally {
      warning.mockRestore();
    }
  });
test("B02: logout outage leaves user signed in and retry completes remote logout", async () => {
  mockStored = "fixture-refresh-seeded";
  render(<Journey />);
  await screen.findByRole("button", { name: /Đăng xuất/i });
  const saved = mockStored;
  mockLogoutFails = true;
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng xuất/i }));
  });
  await screen.findByText("Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.");
  expect(mockStored).toBe(saved);
  expect(screen.getByText("Session: buyer-a")).toBeTruthy();
  mockLogoutFails = false;
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Thử lại/i }));
  });
  await screen.findByPlaceholderText("Email");
  expect(mockStored).toBeNull();
});
test("B01/B02: account change does not retain previous user or product component state", async () => {
  mockStored = "fixture-refresh-seeded";
  render(<Journey />);
  await screen.findByText("Public product buyer-a");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng xuất/i }));
  });
  await screen.findByPlaceholderText("Email");
  expect(screen.queryByText("Public product buyer-a")).toBeNull();
  await submitLogin("second@example.test");
  await screen.findByText("Public product buyer-b");
  expect(screen.getByText("Session: buyer-b")).toBeTruthy();
  expect(screen.queryByText("Session: buyer-a")).toBeNull();
  expect(screen.queryByText("Public product buyer-a")).toBeNull();
});

const future = [
  "B01 full home/category grid — T136",
  "B02 registration — T135",
  "B03 paginated listing — T136",
  "B04 search/filter — T136",
  "B05 product detail/variants — T136",
  "B06 public shop — T136",
  "B07 cart — T137",
  "B08 checkout — T137",
  "B09 order list — T137",
  "B10 order detail/payment — T137",
  "B11 profile/avatar/password — T135",
  "B12 addresses — T135",
  "B13 review — T138",
];
for (const title of future) test.todo(title);
