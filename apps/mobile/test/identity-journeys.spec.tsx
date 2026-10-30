import { Alert, Platform } from "react-native";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";
import type { components } from "@marketplace/api-client";
import { mobileQueryClient } from "../src/features/api/query-client";

type User = components["schemas"]["User"];
type Address = components["schemas"]["Address"];

let mockStored: string | null = null;
let mockUser: User;
let mockAddresses: Address[] = [];
let mockAddressGate: Promise<Response> | null = null;
let mockAddressStarted: (() => void) | null = null;
let mockRegisterFailure = false;
let mockAddressMutationFailure = false;
let mockCalls: Array<{
  path: string;
  method: string;
  body?: unknown;
}> = [];
let mockPickerResult: {
  canceled: boolean;
  assets: Array<{
    uri: string;
    fileName: string;
    mimeType: string;
    width: number;
    height: number;
    fileSize?: number;
  }>;
} = {
  canceled: false,
  assets: [
    {
      uri: "file:///avatar.jpg",
      fileName: "avatar.jpg",
      mimeType: "image/jpeg",
      width: 64,
      height: 64,
    },
  ],
};
const mockRequestMediaLibraryPermissions = jest.fn(async () => ({
  granted: true,
}));
const mockLaunchImageLibrary = jest.fn(async () => mockPickerResult);

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
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: mockRequestMediaLibraryPermissions,
  launchImageLibraryAsync: mockLaunchImageLibrary,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "buyer@example.test",
    fullName: "Buyer One",
    phone: null,
    avatar: null,
    roles: ["BUYER"],
    status: "ACTIVE",
    version: 0,
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function makeAddress(id: string, overrides: Partial<Address> = {}): Address {
  return {
    id,
    recipientName: `Recipient ${id}`,
    phone: "0901234567",
    line1: `House ${id}`,
    ward: "Ward 1",
    district: "District 1",
    province: "Ho Chi Minh City",
    country: "VN",
    isDefault: false,
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android");
  mockStored = null;
  mockUser = makeUser();
  mockAddresses = [];
  mockAddressGate = null;
  mockAddressStarted = null;
  mockRegisterFailure = false;
  mockAddressMutationFailure = false;
  mockCalls = [];
  mockPickerResult = {
    canceled: false,
    assets: [
      {
        uri: "file:///avatar.jpg",
        fileName: "avatar.jpg",
        mimeType: "image/jpeg",
        width: 64,
        height: 64,
      },
    ],
  };
  mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockImplementation(async () => mockPickerResult);
  globalThis.fetch = jest.fn(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    mockCalls.push({ path, method, body });

    if (path.endsWith("/auth/register")) {
      if (mockRegisterFailure)
        return Response.json(
          { error: { code: "EMAIL_TAKEN", message: "Email đã được sử dụng." } },
          { status: 409 },
        );
      mockUser = makeUser({
        email: "new@example.test",
        fullName: "New Buyer",
      });
      return Response.json(
        {
          data: {
            accessToken: "access-registered",
            refreshToken: "refresh-registered",
            user: mockUser,
            expiresIn: 600,
            sessionId: "00000000-0000-4000-8000-000000000010",
          },
        },
        { status: 201 },
      );
    }
    if (path.endsWith("/auth/login"))
      return Response.json({
        data: {
          accessToken: "access-login",
          refreshToken: "refresh-login",
          user: mockUser,
          expiresIn: 600,
          sessionId: "00000000-0000-4000-8000-000000000011",
        },
      });
    if (path.endsWith("/auth/refresh"))
      return Response.json({
        data: {
          accessToken: "access-restored",
          refreshToken: "refresh-rotated",
          user: mockUser,
          expiresIn: 600,
          sessionId: "00000000-0000-4000-8000-000000000012",
        },
      });
    if (path.endsWith("/auth/logout"))
      return new Response(null, { status: 204 });
    if (path.endsWith("/users/me/password"))
      return new Response(null, { status: 204 });
    if (path.endsWith("/users/me/assets"))
      return Response.json(
        {
          data: {
            id: "00000000-0000-4000-8000-000000000020",
            url: "https://assets.example.test/avatar.jpg",
            mimeType: "image/jpeg",
            byteSize: 128,
            width: 64,
            height: 64,
          },
        },
        { status: 201 },
      );
    if (path.endsWith("/users/me/addresses") && method === "GET") {
      if (mockAddressGate) {
        const gate = mockAddressGate;
        mockAddressGate = null;
        mockAddressStarted?.();
        return gate;
      }
      return Response.json({ data: mockAddresses });
    }
    if (path.endsWith("/users/me/addresses") && method === "POST") {
      const created = makeAddress("00000000-0000-4000-8000-000000000021", {
        ...(body as Partial<Address>),
        createdAt: "2026-10-30T00:00:00.000Z",
        updatedAt: "2026-10-30T00:00:00.000Z",
      });
      mockAddresses = [created, ...mockAddresses];
      return Response.json({ data: created }, { status: 201 });
    }
    if (path.includes("/users/me/addresses/")) {
      const id = path.split("/").at(-1) ?? "";
      const current = mockAddresses.find((address) => address.id === id);
      if (method === "DELETE") {
        mockAddresses = mockAddresses.filter((address) => address.id !== id);
        return new Response(null, { status: 204 });
      }
      if (method === "PATCH" && current) {
        if (mockAddressMutationFailure)
          return Response.json(
            {
              error: {
                code: "INTERNAL_ERROR",
                message: "Không thể cập nhật địa chỉ mặc định.",
              },
            },
            { status: 500 },
          );
        const updated = { ...current, ...(body as Partial<Address>) };
        mockAddresses = mockAddresses.map((address) =>
          address.id === id
            ? updated
            : updated.isDefault
              ? { ...address, isDefault: false }
              : address,
        );
        return Response.json({ data: updated });
      }
    }
    if (path.endsWith("/users/me") && method === "PATCH") {
      const patch = body as Partial<User> & { avatarAssetId?: string };
      mockUser = makeUser({
        ...mockUser,
        ...patch,
        ...(patch.avatarAssetId
          ? {
              avatar: {
                id: patch.avatarAssetId,
                url: "https://assets.example.test/avatar.jpg",
                mimeType: "image/jpeg",
                byteSize: 128,
                width: 64,
                height: 64,
              },
            }
          : {}),
      });
      return Response.json({ data: mockUser });
    }
    if (path.endsWith("/users/me")) return Response.json({ data: mockUser });
    throw new Error(`Unexpected identity fixture request: ${method} ${path}`);
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

afterEach(() => {
  mobileQueryClient.clear();
  jest.useRealTimers();
});

test("registration validates contract fields and returns to the requested route", async () => {
  const navigation = renderRouter("./src/app", {
    initialUrl: "/register?returnTo=%2Faccount",
  });
  fireEvent.changeText(
    await screen.findByPlaceholderText("Họ và tên"),
    "New Buyer",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "new@example.test",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu"),
    "valid-password-123",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Tạo tài khoản/i }));
  });

  await waitFor(() => expect(navigation.getPathname()).toBe("/account"));
  expect(mockCalls).toContainEqual({
    path: "/api/v1/auth/register",
    method: "POST",
    body: {
      fullName: "New Buyer",
      email: "new@example.test",
      password: "valid-password-123",
      clientPlatform: "ANDROID",
    },
  });
  expect(mockStored).toBe("refresh-registered");
  expect(await screen.findByText("Hồ sơ")).toBeTruthy();
});

test("registration blocks a password below the contract minimum", async () => {
  renderRouter("./src/app", { initialUrl: "/register" });
  fireEvent.changeText(
    await screen.findByPlaceholderText("Họ và tên"),
    "New Buyer",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "new@example.test",
  );
  fireEvent.changeText(screen.getByPlaceholderText("Mật khẩu"), "short-pass");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Tạo tài khoản/i }));
  });

  expect(
    await screen.findByText("Mật khẩu phải có từ 12 đến 128 ký tự."),
  ).toBeTruthy();
  expect(mockCalls.some((call) => call.path.endsWith("/auth/register"))).toBe(
    false,
  );
});

test("registration displays the API error for a duplicate email", async () => {
  mockRegisterFailure = true;
  renderRouter("./src/app", { initialUrl: "/register" });
  fireEvent.changeText(
    await screen.findByPlaceholderText("Họ và tên"),
    "New Buyer",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "new@example.test",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu"),
    "valid-password-123",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Tạo tài khoản/i }));
  });

  expect(await screen.findByText("Email đã được sử dụng.")).toBeTruthy();
});

test("login validates the contract email before sending a request", async () => {
  renderRouter("./src/app", { initialUrl: "/account" });
  fireEvent.changeText(await screen.findByPlaceholderText("Email"), "x");
  fireEvent.changeText(screen.getByPlaceholderText("Mật khẩu"), "");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng nhập/i }));
  });

  expect(await screen.findByText("Vui lòng nhập email hợp lệ.")).toBeTruthy();
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "buyer@example.test",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Đăng nhập/i }));
  });
  expect(
    await screen.findByText("Mật khẩu phải có từ 1 đến 128 ký tự."),
  ).toBeTruthy();
  expect(mockCalls.some((call) => call.path.endsWith("/auth/login"))).toBe(
    false,
  );
});

test("profile updates fields and changes the password through the API", async () => {
  mockStored = "refresh-existing";
  renderRouter("./src/app", { initialUrl: "/account" });
  fireEvent.changeText(
    await screen.findByPlaceholderText("Họ và tên"),
    "Buyer Updated",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Số điện thoại"),
    "0901234567",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Lưu hồ sơ/i }));
  });
  expect(await screen.findByText("Đã lưu hồ sơ.")).toBeTruthy();
  expect(mockCalls).toContainEqual({
    path: "/api/v1/users/me",
    method: "PATCH",
    body: { fullName: "Buyer Updated", phone: "0901234567" },
  });

  fireEvent.press(screen.getByRole("button", { name: /Đổi mật khẩu/i }));
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu hiện tại"),
    "current-password",
  );
  fireEvent.changeText(
    screen.getByPlaceholderText("Mật khẩu mới"),
    "a-new-password-123",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Lưu mật khẩu/i }));
  });
  expect(await screen.findByText("Đã đổi mật khẩu.")).toBeTruthy();
  expect(mockCalls).toContainEqual({
    path: "/api/v1/users/me/password",
    method: "POST",
    body: {
      currentPassword: "current-password",
      newPassword: "a-new-password-123",
    },
  });
});

test("avatar selection uploads an AVATAR asset and attaches it to the profile", async () => {
  mockStored = "refresh-existing";
  renderRouter("./src/app", { initialUrl: "/account" });
  await screen.findByPlaceholderText("Họ và tên");
  fireEvent.press(screen.getByRole("button", { name: /Chọn ảnh đại diện/i }));

  await waitFor(() =>
    expect(
      mockCalls.some((call) => call.path.endsWith("/users/me/assets")),
    ).toBe(true),
  );
  const upload = mockCalls.find((call) =>
    call.path.endsWith("/users/me/assets"),
  );
  expect(upload?.method).toBe("POST");
  expect(upload?.body).toBeInstanceOf(FormData);
  expect(mockCalls).toContainEqual({
    path: "/api/v1/users/me",
    method: "PATCH",
    body: { avatarAssetId: "00000000-0000-4000-8000-000000000020" },
  });
  expect(await screen.findByText("Đã cập nhật ảnh đại diện.")).toBeTruthy();
  expect(await screen.findByLabelText("Ảnh đại diện")).toBeTruthy();
});

test("avatar rejects files outside the contract size limit", async () => {
  mockStored = "refresh-existing";
  mockPickerResult.assets[0].fileSize = 5 * 1024 * 1024 + 1;
  renderRouter("./src/app", { initialUrl: "/account" });
  await screen.findByPlaceholderText("Họ và tên");
  fireEvent.press(screen.getByRole("button", { name: /Chọn ảnh đại diện/i }));

  expect(
    await screen.findByText("Ảnh đại diện phải nhỏ hơn hoặc bằng 5 MB."),
  ).toBeTruthy();
  expect(mockCalls.some((call) => call.path.endsWith("/users/me/assets"))).toBe(
    false,
  );
});

test("addresses show loading then a retryable error state", async () => {
  mockStored = "refresh-existing";
  let finishAddresses!: (response: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  mockAddressGate = new Promise<Response>((resolve) => {
    finishAddresses = resolve;
  });
  mockAddressStarted = markStarted;
  renderRouter("./src/app", { initialUrl: "/account/addresses" });
  await screen.findByText("Địa chỉ");
  await started;
  expect(screen.getByText("Đang tải địa chỉ…")).toBeTruthy();

  await act(async () => {
    finishAddresses(
      Response.json(
        { error: { code: "INTERNAL_ERROR", message: "Server error" } },
        { status: 500 },
      ),
    );
  });
  expect(await screen.findByText("Server error")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: /Thử lại/i }));
  expect(await screen.findByText("Chưa có địa chỉ.")).toBeTruthy();
});

test("addresses create, edit, set default, and delete with confirmation", async () => {
  mockStored = "refresh-existing";
  mockAddresses = [
    makeAddress("00000000-0000-4000-8000-000000000031", {
      recipientName: "Home One",
      isDefault: true,
    }),
    makeAddress("00000000-0000-4000-8000-000000000032", {
      recipientName: "Home Two",
    }),
  ];
  renderRouter("./src/app", { initialUrl: "/account/addresses" });
  expect(await screen.findByText("Home One")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: /Sửa Home One/i }));
  fireEvent.changeText(
    screen.getByPlaceholderText("Địa chỉ"),
    "12 Main Street",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Lưu địa chỉ/i }));
  });
  expect(await screen.findByText("Đã lưu địa chỉ.")).toBeTruthy();
  expect(
    mockCalls.some(
      (call) =>
        call.method === "PATCH" &&
        call.path.includes("00000000-0000-4000-8000-000000000031"),
    ),
  ).toBe(true);

  fireEvent.press(
    screen.getByRole("button", { name: /Đặt mặc định cho Home Two/i }),
  );
  await waitFor(() => {
    const update = mockCalls.find(
      (call) =>
        call.method === "PATCH" &&
        call.path.includes("00000000-0000-4000-8000-000000000032"),
    );
    expect(update?.body).toMatchObject({ isDefault: true });
  });

  const alert = jest
    .spyOn(Alert, "alert")
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === "destructive")?.onPress?.();
    });
  fireEvent.press(screen.getByRole("button", { name: /Xóa Home One/i }));
  await waitFor(() =>
    expect(
      mockCalls.some(
        (call) =>
          call.method === "DELETE" &&
          call.path.includes("00000000-0000-4000-8000-000000000031"),
      ),
    ).toBe(true),
  );
  expect(alert).toHaveBeenCalled();
});

test("address mutation errors do not hide the add action or retry list loading", async () => {
  mockStored = "refresh-existing";
  mockAddresses = [
    makeAddress("00000000-0000-4000-8000-000000000032", {
      recipientName: "Home Two",
    }),
  ];
  mockAddressMutationFailure = true;
  renderRouter("./src/app", { initialUrl: "/account/addresses" });
  expect(await screen.findByText("Home Two")).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", { name: /Đặt mặc định cho Home Two/i }),
  );

  expect(
    await screen.findByText("Không thể cập nhật địa chỉ mặc định."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: /Thêm địa chỉ/i })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Thử lại/i })).toBeNull();
  expect(
    mockCalls.filter(
      (call) =>
        call.method === "GET" && call.path.endsWith("/users/me/addresses"),
    ),
  ).toHaveLength(1);
});

test("addresses enforce contract phone length before create", async () => {
  mockStored = "refresh-existing";
  renderRouter("./src/app", { initialUrl: "/account/addresses" });
  await screen.findByText("Chưa có địa chỉ.");
  fireEvent.press(screen.getByRole("button", { name: /Thêm địa chỉ/i }));
  fireEvent.changeText(screen.getByPlaceholderText("Người nhận"), "Buyer");
  fireEvent.changeText(screen.getByPlaceholderText("Điện thoại"), "1234567");
  fireEvent.changeText(
    screen.getByPlaceholderText("Địa chỉ"),
    "12 Main Street",
  );
  fireEvent.changeText(screen.getByPlaceholderText("Phường"), "Ward");
  fireEvent.changeText(screen.getByPlaceholderText("Quận"), "District");
  fireEvent.changeText(
    screen.getByPlaceholderText("Tỉnh / thành phố"),
    "Province",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: /Lưu địa chỉ/i }));
  });

  expect(
    await screen.findByText(
      "Vui lòng kiểm tra độ dài các trường địa chỉ theo yêu cầu.",
    ),
  ).toBeTruthy();
  expect(
    mockCalls.some(
      (call) =>
        call.method === "POST" && call.path.endsWith("/users/me/addresses"),
    ),
  ).toBe(false);
});
