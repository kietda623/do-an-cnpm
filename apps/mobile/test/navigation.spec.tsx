import { Platform } from "react-native";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from "expo-router/testing-library";

let mockStored: string | null = null;
let mockRefreshUnauthorized = false;
let mockProductsUnauthorized = false;
let mockProductsForbidden = false;
let mockCalls: string[] = [];

jest.mock("expo-constants", () => ({
  expoConfig: { extra: { apiBaseUrl: "https://example.test/api/v1" } },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => mockStored),
  setItemAsync: jest.fn(async (_key: string, value: string) => {
    mockStored = value;
  }),
  deleteItemAsync: jest.fn(async () => {
    mockStored = null;
  }),
}));

const originalFetch = globalThis.fetch;
const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "T133 Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-29T00:00:00.000Z",
  updatedAt: "2026-10-29T00:00:00.000Z",
};

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android");
  mockStored = null;
  mockRefreshUnauthorized = false;
  mockProductsUnauthorized = false;
  mockProductsForbidden = false;
  mockCalls = [];
  globalThis.fetch = jest.fn(async (input, init) => {
    const pathname = new URL(String(input)).pathname;
    mockCalls.push(pathname);
    expect(init?.credentials).toBe("omit");
    if (pathname.endsWith("/auth/refresh")) {
      if (mockRefreshUnauthorized)
        return Response.json(
          { error: { code: "SESSION_REVOKED", message: "Sign in again" } },
          { status: 401 },
        );
      return Response.json({
        data: {
          accessToken: "t133-access",
          refreshToken: "t133-refresh-rotated",
          user: buyer,
        },
      });
    }
    if (pathname.endsWith("/auth/login"))
      return Response.json({
        data: {
          accessToken: "t133-access",
          refreshToken: "t133-refresh-login",
          user: buyer,
        },
      });
    if (pathname.endsWith("/auth/logout"))
      return new Response(null, { status: 204 });
    if (pathname.endsWith("/products")) {
      if (mockProductsForbidden)
        return Response.json(
          { error: { code: "FORBIDDEN", message: "Not allowed" } },
          { status: 403 },
        );
      if (mockProductsUnauthorized)
        return Response.json(
          { error: { code: "SESSION_REVOKED", message: "Sign in again" } },
          { status: 401 },
        );
      return Response.json({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            shopId: "00000000-0000-4000-8000-000000000003",
            shopName: "Public shop",
            name: "T133 public product",
            minimumPrice: "12000",
            available: true,
            ratingCount: 0,
            createdAt: "2026-10-29T00:00:00.000Z",
          },
        ],
      });
    }
    throw new Error(`Unexpected T133 fixture endpoint: ${pathname}`);
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

async function signIn() {
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "buyer@example.test",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu"),
    "fixture-password",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng nhập/i }));
  });
}

async function openRoute(initialUrl: string) {
  const navigation = renderRouter("./src/app", { initialUrl });
  await act(async () => {
    // Flush initial SecureStore restoration before asserting route state.
  });
  return navigation;
}

test("the public home loads product data through the generated API client", async () => {
  const navigation = await openRoute("/");
  expect(await screen.findByText("T133 public product")).toBeTruthy();
  expect(navigation.getPathname()).toBe("/");
  expect(mockCalls).toContain("/api/v1/products");
  expect(screen.queryByPlaceholderText("Email")).toBeNull();
});

test("shared API state presents forbidden responses without exposing server messages", async () => {
  mockProductsForbidden = true;
  await openRoute("/");
  expect(
    await screen.findByText("Bạn không có quyền xem nội dung này."),
  ).toBeTruthy();
  expect(screen.queryByText("Not allowed")).toBeNull();
});

test.each([
  ["/products", "Danh sách sản phẩm"],
  ["/products/search", "Tìm kiếm và lọc sản phẩm"],
  ["/products/public-product", "Chi tiết sản phẩm"],
  ["/shops/public-shop", "Cửa hàng"],
])("guest can open public route %s", async (path, heading) => {
  const navigation = await openRoute(path);
  expect(
    await screen.findByText(new RegExp(`${heading} đang phát triển`)),
  ).toBeTruthy();
  expect(navigation.getPathname()).toBe(path);
  expect(screen.queryByPlaceholderText("Email")).toBeNull();
  expect(screen.getByText(/đang phát triển/i)).toBeTruthy();
});

test.each([
  ["/cart", "Giỏ hàng"],
  ["/checkout", "Thanh toán"],
  ["/orders", "Đơn hàng"],
  ["/orders/order-123", "Chi tiết đơn hàng"],
  ["/account", "Hồ sơ"],
  ["/account/addresses", "Địa chỉ"],
  ["/reviews/order-item-123", "Đánh giá"],
])(
  "guest is sent to login and returns to protected route %s",
  async (path, heading) => {
    const navigation = await openRoute(path);
    expect(await screen.findByPlaceholderText("Email")).toBeTruthy();
    expect(navigation.getPathname()).toBe("/login");
    expect(navigation.getSearchParams().returnTo).toBe(path);
    await signIn();
    expect(
      await screen.findByText(new RegExp(`${heading} đang phát triển`)),
    ).toBeTruthy();
    expect(navigation.getPathname()).toBe(path);
    expect(screen.getByText(/đang phát triển/i)).toBeTruthy();
  },
);

test("logout clears the session and replaces the protected screen with login", async () => {
  mockStored = "t133-refresh-seed";
  const navigation = await openRoute("/cart");
  expect(await screen.findByText(/Giỏ hàng.*đang phát triển/i)).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng xuất/i }));
  });
  expect(await screen.findByPlaceholderText("Email")).toBeTruthy();
  expect(navigation.getPathname()).toBe("/login");
  expect(mockStored).toBeNull();
  expect(screen.queryByText(/Giỏ hàng.*đang phát triển/i)).toBeNull();
});

test("a refresh 401 clears session and protected screen state", async () => {
  mockStored = "t133-refresh-seed";
  mockRefreshUnauthorized = true;
  const navigation = await openRoute("/cart");
  expect(await screen.findByPlaceholderText("Email")).toBeTruthy();
  expect(navigation.getPathname()).toBe("/login");
  expect(mockStored).toBeNull();
  expect(screen.queryByText(/Giỏ hàng.*đang phát triển/i)).toBeNull();
});

function loadAppConfig(environment: Record<string, string>) {
  const names = [
    "EXPO_PUBLIC_API_URL",
    "APP_VARIANT",
    "EXPO_ALLOW_HTTP",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  jest.resetModules();
  for (const name of names) delete process.env[name];
  Object.assign(process.env, environment);
  try {
    let config: {
      scheme: string;
      extra: Record<string, unknown>;
      plugins: unknown[];
    };
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load the config after applying this test's environment.
      config = require("../app.config").default;
    });
    return config!;
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("app links use marketplace-buyer scheme and explicit build variants preserve cleartext policy", () => {
  const development = loadAppConfig({
    EXPO_PUBLIC_API_URL: "http://10.0.2.2:4000/api/v1",
    APP_VARIANT: "development",
    EXPO_ALLOW_HTTP: "1",
  });
  expect(development.scheme).toBe("marketplace-buyer");
  expect(development.extra.appVariant).toBe("development");
  const devBuildProperties = development.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  ) as [string, { android: { usesCleartextTraffic: boolean } }];
  expect(devBuildProperties[1].android.usesCleartextTraffic).toBe(true);

  const production = loadAppConfig({
    EXPO_PUBLIC_API_URL: "https://api.example.test/api/v1",
    APP_VARIANT: "production",
    EXPO_ALLOW_HTTP: "1",
  });
  expect(production.extra.appVariant).toBe("production");
  const prodBuildProperties = production.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  ) as [string, { android: { usesCleartextTraffic: boolean } }];
  expect(prodBuildProperties[1].android.usesCleartextTraffic).toBe(false);
  expect(() =>
    loadAppConfig({
      EXPO_PUBLIC_API_URL: "http://api.example.test/api/v1",
      APP_VARIANT: "production",
      EXPO_ALLOW_HTTP: "1",
    }),
  ).toThrow(/requires HTTPS/);
});
