import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import Login from "../src/app/(auth)/login";
import Home from "../src/app/(public)/index";

const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockUser: { id: string } | null = null;
const mockRequest = jest.fn();
const mockApi = { request: mockRequest };
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock("../src/features/auth/session-provider", () => ({
  useSession: () => ({
    login: mockLogin,
    logout: mockLogout,
    user: mockUser,
    api: mockApi,
  }),
}));

beforeEach(() => {
  queryClient.clear();
  mockLogin.mockReset();
  mockRequest.mockReset();
  mockLogout.mockReset();
  mockUser = null;
});

function renderHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>,
  );
}

test("reports a failed logout and lets the signed-in user retry", async () => {
  mockUser = { id: "buyer" };
  mockRequest.mockImplementation((path) =>
    Promise.resolve(
      path === "/categories" ? [] : [{ id: "p1", name: "Sample product" }],
    ),
  );
  mockLogout
    .mockRejectedValueOnce(new TypeError("network unavailable"))
    .mockResolvedValueOnce(undefined);
  renderHome();
  await screen.findByText("Sample product");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Đăng xuất" }));
  });
  expect(
    await screen.findByText(
      "Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  });
  expect(mockLogout).toHaveBeenCalledTimes(2);
  expect(
    screen.queryByText("Không thể đăng xuất. Kiểm tra kết nối rồi thử lại."),
  ).toBeNull();
});
test("logs in with email and password", async () => {
  mockLogin.mockResolvedValue(undefined);
  await render(<Login />);
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "buyer@example.test",
  );
  fireEvent.changeText(screen.getByPlaceholderText("Mật khẩu"), "password");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Đăng nhập" }));
  });
  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith("buyer@example.test", "password"),
  );
});
test("reports an error and retries to an empty list", async () => {
  let failProducts = true;
  mockRequest.mockImplementation((path) => {
    if (path === "/categories") return Promise.resolve([]);
    if (failProducts) {
      failProducts = false;
      return Promise.reject(new Error("network"));
    }
    return Promise.resolve([]);
  });
  renderHome();
  await screen.findByText(
    "Không thể tải dữ liệu. Kiểm tra kết nối rồi thử lại.",
  );
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  });
  await screen.findByText("Chưa có sản phẩm.");
  expect(
    mockRequest.mock.calls.filter(([path]) => path !== "/categories"),
  ).toHaveLength(2);
});
test("loads products from the API", async () => {
  mockRequest.mockImplementation((path) =>
    Promise.resolve(
      path === "/categories" ? [] : [{ id: "p1", name: "Sample product" }],
    ),
  );
  renderHome();
  await waitFor(() => expect(screen.getByText("Sample product")).toBeTruthy());
  expect(
    mockRequest.mock.calls.some(([path]) =>
      String(path).startsWith("/products?"),
    ),
  ).toBe(true);
});
